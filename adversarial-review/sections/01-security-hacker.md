# 01 — Security review (adversarial / hacker perspective)

Target: **Всетут** task-planner — ASP.NET Core 8 API (`server/`, port 5080) + React/Vite client.
Method: full read of every controller and service, `Program.cs`, `AppDbContext`, auth/billing/email
services, and all EF model/key configuration. Each finding below is backed by a source citation and
a runnable PoC under `adversarial-review/poc/security/`.

> **Scope note / honesty:** No live server or MySQL was available in this environment, so the PoC
> scripts were **not executed** here. Every finding is nonetheless confirmed statically from the
> source (file:line + quoted code). The PoCs are concrete and runnable against a live instance.

## Severity summary (most severe first)

| # | Finding | Severity |
|---|---------|----------|
| 1 | Forgeable JWT — committed placeholder signing key → impersonate any user | **Critical** |
| 2 | Paywall bypass — mock self-confirm **and** unsigned WayForPay callback | **Critical** |
| 3 | Email verification code brute-forceable (no lockout, no rate limit) → email identity takeover | **High** |
| 4 | No token revocation; 90-day lifetime; logout is client-side only | **High** |
| 5 | Committed secrets in git (JWT key, WayForPay MerchantSecretKey) + weak HMAC-MD5 | **High** |
| 6 | Account / user enumeration + unauthenticated send-code abuse | **Medium** |
| 7 | No rate limiting anywhere (brute force / DoS enabler) | **Medium** |
| 8 | No transport hardening (no HTTPS redirect/HSTS/security headers) | **Low / Medium** |
| 9 | `LastActiveAt` middleware does a DB write per request | **Low** |

### Modules that were attacked and found **not** vulnerable (verified, not assumed)

- **Broken object-level authorization (IDOR):** every module — Tasks, RecurrenceRules, Finance,
  Cycle, MedicineCabinet, HealthProfile, Study, Work, Notes, Shopping, Media(watchlist), Todo,
  Checkup, Account — scopes **every** read/write/delete by the authenticated `userId`
  (`.Where(x => x.Id == id && x.UserId == userId)` or a `UserId`-keyed `FindAsync`). No endpoint
  acts on an id without an ownership filter. See "IDOR sweep" at the end. **No IDOR found.**
- **Mass assignment / over-posting:** controllers bind request-record DTOs, never the EF entities;
  `UserId`, `Id`, `QuickAddUnlocked` are set server-side only. **Not exploitable.**
- **SQL injection:** no `FromSqlRaw`/`ExecuteSqlRaw`/string-interpolated SQL anywhere; all queries are
  LINQ/parameterized. **Not present.**
- **File upload / path traversal:** there is **no** file-upload or file-serving endpoint. The
  "MediaController" is a books/videos watchlist, not media files. `Path.Combine` appears only in the
  offline import CLI over fixed seed paths. **Not applicable.**
- **Missing `[Authorize]`:** every controller is `[Authorize]` at class level except `HealthController`
  (a DB ping) and the two intentionally `[AllowAnonymous]` billing provider callbacks. No protected
  action is reachable anonymously.

---

## 1. Critical — Forgeable JWT: committed placeholder signing key lets anyone impersonate any user

**Severity:** Critical
**Location:**
- `server/appsettings.json:12` → `"Key": "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION"`
- `server/appsettings.Development.json` (no Jwt section → prod value is used in dev too)
- `server/Services/JwtService.cs:21` (signs with `Jwt:Key`), `:34` (90-day expiry)
- `server/Program.cs:49` (validates with the same key)

**Description:** The HS256 signing secret is a hard-coded placeholder committed to the git repo. The
token is symmetric: the key that *verifies* a token is the same key that *signs* one. Anyone who can
read the repository (a diploma project repo) possesses the secret and can mint a token with an
arbitrary `sub` (userId) and `email` claim. The userId claim is exactly what every controller trusts:

```csharp
private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);
```

So a forged `sub=<N>` is full authentication as user N — for *every* user in the system.

**Attack / PoC:** `poc/security/01-jwt-forgery.ps1` — builds a valid HS256 JWT offline using the
committed key and calls `/api/auth/me`, then `/api/account/export` to exfiltrate the victim's entire
dataset (tasks, finances, cycle, health, medicine cabinet, everything).

**Impact:** Total compromise of every account: read/modify/delete all data, full data export, account
deletion (the delete endpoint re-checks the password, but wipe/export and all module data do not).
Because the same value ships in `appsettings.json`, any deployment that doesn't override `Jwt:Key`
is trivially forgeable by anyone with repo access.

**Exploitability:** Trivial. Offline token minting; no interaction with the victim required.

---

## 2. Critical — Paywall bypass: free unlock via mock self-confirm and an unsigned provider callback

**Severity:** Critical (for the paid-feature integrity; it is the one feature users pay 100 ₴ for)
**Location:**
- `server/appsettings.json:15` `Billing:Mock = true` (the shipped default) and
  `server/Services/BillingService.cs:43` (`Mock` defaults to `true`)
- `server/Services/BillingService.cs:109` — `var approved = Mock || await CheckWayForPayApprovedAsync(...)`
- `server/Controllers/BillingController.cs:67` — `[AllowAnonymous] POST /api/billing/callback`
- `server/Services/BillingService.cs:117-139` — `HandleCallbackAsync` never verifies `merchantSignature`

**Description — two independent bypasses:**

**(A) Mock self-confirm (default config).** With `Mock=true` (the default), `ConfirmAsync` treats the
order as approved unconditionally. Any authenticated user calls `POST /api/billing/checkout` to get an
`orderReference`, then `POST /api/billing/confirm` with it, and `QuickAddUnlocked` is set to `true`
without any payment. In the shipped default this is a 100 % free unlock of the paid feature.

**(B) Forged callback (works even with `Mock=false`, i.e. "production").** The provider callback is
`[AllowAnonymous]` and `HandleCallbackAsync` parses only `orderReference` and `transactionStatus` from
the raw body and, if the status is `"Approved"`, flips the account to unlocked:

```csharp
orderRef = root.TryGetProperty("orderReference", ...);
status   = root.TryGetProperty("transactionStatus", ...);
if (!string.IsNullOrEmpty(orderRef) && status == "Approved") {
    var payment = ... FirstOrDefaultAsync(p => p.OrderReference == orderRef);
    if (payment?.User is not null) await EnsureUnlockedAsync(payment.User, payment);
}
// NOTE: incoming merchantSignature is never computed or compared.
```

There is **no verification of the incoming signature**. An attacker sends an unauthenticated
`POST /api/billing/callback` with `{"orderReference":"<a Pending order>","transactionStatus":"Approved"}`
and the owner of that order is unlocked — no money, no valid signature. The attacker can mint their own
`orderReference` via `/billing/checkout`; the format `qa-{userId}-{yyyyMMddHHmmss}-{6hex}`
(`BillingService.cs:75`) also leaks the target userId and is low-entropy enough to attempt against a
victim who has a pending order.

**Attack / PoC:** `poc/security/02-billing-paywall-bypass.ps1` (both variants).

**Impact:** The single monetised feature is bypassable by every user; revenue integrity is zero. The
callback also accepts forged "Approved" events for *any* order, so it can mark arbitrary payments paid.

**Exploitability:** (A) trivial in the default build; (B) trivial for self-unlock, and feasible against
others given a known/guessed pending `orderReference`.

---

## 3. High — Email verification code is brute-forceable → register under someone else's gmail

**Severity:** High
**Location:**
- `server/Controllers/AuthController.cs:53` — `Random.Shared.Next(0,1_000_000).ToString("D6")` (6 digits)
- `server/Controllers/AuthController.cs:86-91` — code check with no attempt counter
- `server/Models/EmailVerificationCode.cs` — no `Attempts` field
- `server/Controllers/AuthController.cs:22` — 10-minute lifetime; no rate limiting on the endpoint

**Description:** The verification code space is only 1,000,000. `EmailVerificationCode` has no failed-
attempt counter, `/api/auth/register` has no per-email lockout, and the application has no rate limiter
at all (nothing in `Program.cs`). The lookup accepts any still-valid unused code:

```csharp
.Where(c => c.Email == email && c.Code == request.Code && !c.IsUsed && c.ExpiresAt > DateTime.UtcNow)
```

Since `send-code` is blocked for already-registered emails, the realistic attack is **identity
pre-emption**: for a gmail the victim has *not yet* registered, the attacker triggers `send-code` (the
real code goes to the victim's inbox, unseen by the attacker), then brute-forces `register` across
`000000..999999` within the 10-minute window. On success the attacker owns an account bound to the
victim's email and receives a JWT. New codes can be re-requested to refresh the window.

**Attack / PoC:** `poc/security/03-email-code-bruteforce.ps1` (demo range; real attack uses full
0..999999). Proves no lockout / no rate limit.

**Impact:** Account creation under a victim's email identity; squatting on the victim's address so the
real person cannot register; downstream trust abuse of a "@gmail.com-verified" account.

**Exploitability:** Medium-High — 10⁶ online guesses in 10 min is feasible with light parallelism given
zero throttling; keyspace is tiny for an online oracle.

---

## 4. High — No token revocation; 90-day lifetime; logout is client-side only

**Severity:** High
**Location:** `server/Services/JwtService.cs:34` (`AddDays(90)`), no blacklist/jti/session store
anywhere; client logout only clears `localStorage.authToken`.

**Description:** Tokens are valid for 90 days and cannot be invalidated server-side. "Logout" merely
drops the token on the client; the same bearer keeps authenticating against the API. Combined with
Finding #1 (forgeable) and #5 (committed key), there is no way to contain a leaked or forged token
short of rotating the global signing key (which logs everyone out). No refresh/rotation, no
per-device sessions.

**Attack / PoC:** `poc/security/05-token-never-revoked.ps1` — reuse a token after UI logout.

**Impact:** A stolen token (XSS on the SPA, shared computer, shoulder-surf of localStorage) grants 90
days of access with no remediation path.

**Exploitability:** Depends on obtaining a token, but the blast radius once obtained is large.

---

## 5. High — Committed secrets in git + weak HMAC-MD5 for payment signatures

**Severity:** High
**Location:**
- `server/appsettings.json:12` — JWT key (see #1)
- `server/appsettings.json:24` & `appsettings.Development.json:28` — `MerchantSecretKey "flk3409refn54t54t*FNJRET"`
- `server/Services/BillingService.cs:211-216` — `HmacMd5` using **MD5**, with the secret as a fallback literal

**Description:** Both the JWT signing key and the WayForPay `MerchantSecretKey` are committed to the
repository (and the secret is additionally hard-coded as a fallback in `BillingService.HmacMd5`). The
payment signature uses **HMAC-MD5**, a broken/legacy hash. With the secret in hand an attacker can
forge any WayForPay `merchantSignature` (checkout fields, CHECK_STATUS, and callback accept-signatures).
This compounds Finding #2: even the outbound integrity story is undermined, and the inbound callback
doesn't check signatures at all.

**Impact:** Loss of all cryptographic trust in both authentication and payment flows. Secrets cannot be
rotated by deployment config alone because one is also a code literal.

**Exploitability:** Secrets are readable by anyone with repo access; forging MD5-HMAC with a known key
is instant.

---

## 6. Medium — Account/user enumeration + unauthenticated email-send abuse

**Severity:** Medium
**Location:** `server/Controllers/AuthController.cs:50-51` (send-code), `:83-84` (register) both return
`email_taken` for registered addresses; `:62` sends mail unconditionally for new addresses.

**Description:** `send-code` and `register` return a distinct `email_taken` error for addresses that are
already registered, giving a reliable registered/not-registered oracle. `send-code` is unauthenticated,
has no CAPTCHA and no rate limit, so it is also an email-sending gun once SMTP is configured
(mailbox spam / mail-bombing of arbitrary gmail addresses, with the app as the sender). (Login itself
is safe — it returns a generic `invalid_credentials`, `AuthController.cs:124-125`.)

**Attack / PoC:** `poc/security/04-account-enumeration-and-abuse.http`.

**Impact:** Privacy leak (who has an account), target list building, and outbound email abuse/reputation
damage.

---

## 7. Medium — No rate limiting anywhere

**Severity:** Medium
**Location:** `server/Program.cs` — no `AddRateLimiter`/`UseRateLimiter`; no per-endpoint throttling.

**Description:** Nothing throttles any endpoint. This is the force-multiplier behind Findings #3
(code brute force), #6 (send-code spam, enumeration), and enables online password guessing on
`/api/auth/login` (only bcrypt's cost slows it). It also leaves the API open to simple request-flood
DoS, amplified by Finding #9.

**Impact:** Brute force and DoS feasibility across auth and billing surfaces.

---

## 8. Low / Medium — No transport or response hardening

**Severity:** Low / Medium
**Location:** `server/Program.cs` — no `UseHttpsRedirection`, no `UseHsts`, no security headers
(HSTS/CSP/X-Content-Type-Options/etc.); Swagger is dev-only (`:87-91`, acceptable); CORS is correctly
restricted to `http://localhost:5173` (`:62-70`).

**Description:** Bearer tokens (90-day, forgeable — #1/#4) travel with no enforced TLS and no HSTS, so a
network attacker on plain HTTP can capture them. No security-header middleware. These are
deployment-hardening gaps rather than a direct logic flaw, but they widen the token-theft surface.

**Impact:** Token interception / downgrade on hostile networks; missing defense-in-depth headers.

---

## 9. Low — Per-request DB write in the `LastActiveAt` middleware

**Severity:** Low (informational)
**Location:** `server/Program.cs:100-112`.

**Description:** On every request the middleware reads the `sub` claim and, for authenticated users,
issues an `ExecuteUpdateAsync` against `Users`. Ordering is correct — it runs *after*
`UseAuthentication`/`UseAuthorization` (`:94-95`), so `User` is populated and an unauthenticated/spoofed
`sub` is simply skipped (unauthenticated requests have no validated claims). The guard
`u.LastActiveAt < since` means the UPDATE usually touches 0 rows and fires at most once/day/user, so the
practical impact is small. It is noted only as an extra DB round-trip per request that, combined with
the absence of rate limiting (#7), slightly amplifies flood pressure.

**Impact:** Minor performance/DoS amplifier; not independently exploitable.

---

## Appendix — IDOR sweep (evidence that object authorization is sound)

Every id-addressed mutation/read was verified to carry an ownership filter:

- **Tasks / Recurrence** `TaskService.cs`: `UpdateTaskAsync`/`DeleteTaskAsync`/`ResolveTaskAsync` and all
  rule/exception/manual-date ops filter `t.UserId == userId` / `r.UserId == userId` (lines 416, 467, 487,
  576, 605, 619, 633, 646, 656, 673) before touching child rows.
- **Finance** `FinanceService.cs:163,179,193` — transaction/category ops filtered by `userId`.
- **Cycle** `CycleService.cs:101,123,130,142,152` — records filtered by `userId` (end-by-date query at
  :109-112 is scoped by `x.UserId == userId`).
- **MedicineCabinet** `MedicineService.cs:176-207, 211-253, 337-351` — cabinet/condition ops by `userId`.
- **HealthProfile** `HealthProfileController.cs` — `UserProfiles.FindAsync(CurrentUserId)` (PK is `UserId`,
  `AppDbContext.cs:97-98`), restrictions filtered by `UserId`.
- **Study** `StudyService.cs:129,144,194,209,289,323,351,421,433,442,453,466` — all by `userId`
  (project steps via `s.Project!.UserId == userId`).
- **Work** `WorkService.cs:156,169,182,239,257,259,275,365,382,415,427,460,474,507,519,558,571` — all by `userId`.
- **Shopping** `ShoppingService.cs:147,156,169,185,214,221` — all by `userId`.
- **Media/Todo/Notes/Checkup** — controller queries use `x.Id == id && x.UserId == CurrentUserId`.
- **Account** — export/wipe/delete all operate on `CurrentUserId`; delete & wipe additionally require the
  current password (`AccountController.cs:56,65,70-75`).
- **`FindAsync(userId)` calls** (CycleSettings/FinanceAccounts/StudySettings/WorkSettings/UserProfiles)
  are safe because those tables are keyed by `UserId` (`AppDbContext.cs:97-98, 250, 266, 302, 322`).

No cross-user object access was found.
