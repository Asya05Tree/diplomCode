# 02 — Robustness: the "Fool" (ДУРАК) and the "Child" (РЕБЁНОК)

**Target:** «Всетут» planner — `server/` (ASP.NET Core 8 + EF Core + Pomelo MySQL, :5080) and `client/` (React 19 + Vite).
**Threat model:** no exploit skill assumed. A *fool* types nonsense into fields; a *child* mashes buttons, pastes junk, and drags date pickers to absurd values. Everything here is reachable through the normal UI or a single hand-crafted request by an authenticated user against **their own** account.
**Method:** code audit + live execution against the running API (:5080, MySQL `planner-mysql`) and direct Node execution of the client NLP parser. Each finding is marked **EXECUTED** (reproduced live) or **CODE-CONFIRMED** (proven by reading the code; not run).

All PoCs live in `adversarial-review/poc/robustness/`:
- `nlp_fuzz.mjs`, `nlp_scaling.mjs` — drive the real parser with pathological inputs (Node).
- `mint_token.mjs` — mints a JWT for an isolated throwaway user using the dev secret.
- `server_poc.sh` — reproduces every server 500/overflow/DoS end-to-end and cleans up after itself.

> **Systemic root cause:** `server/Program.cs` installs **no exception-handling middleware** (no `UseExceptionHandler`, no `ProblemDetails` mapper). Therefore *any* unhandled exception on user input becomes an HTTP **500**, and in the Development profile the **full .NET stack trace is returned in the response body** (observed in every 500 below) — an information leak on top of the crash. Per the brief, *every 500 on user input is a finding.*

---

## Severity ranking (worst first)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Recurrence pattern `int.Parse` → persistent 500 on the entire calendar | **Critical** | EXECUTED |
| 2 | NLP quick-add parser is O(n²) → multi-second…minute main-thread freeze | **High** | EXECUTED |
| 3 | `GET /api/finance/stats` unvalidated `year` → 500 (even with no params) | **High** | EXECUTED |
| 4 | `SetLimit` / `receipt-total` decimal not clamped → 500 on large amounts | **High** | EXECUTED |
| 5 | `GET /api/tasks/free-days` unclamped day-loop → DoS + 500 on wide range | **Medium** | EXECUTED |
| 6 | NLP parser throws `TypeError` on non-string input | **Low** | EXECUTED |
| 7 | `SetLimit` silently accepts negative limits (data integrity) | **Low** | EXECUTED |
| 8 | No `HasMaxLength`: indexed string cols are `varchar(255)` → overflow risk | **Low** | CODE-CONFIRMED |
| 9 | Stored control/RTL/emoji/`<script>` text accepted verbatim (stored-XSS surface) | **Low/Info** | EXECUTED |

---

## Finding 1 — Malformed recurrence pattern permanently breaks the whole calendar (unvalidated `int.Parse`)

**Severity:** Critical (self-service denial of the app's core feature; persistent).
**Status:** EXECUTED.
**Location:**
- Validation gap: `server/Controllers/RecurrenceRulesController.cs:48-69` (`IsValidRule`).
- Crash sites: `server/Services/TaskService.cs:133` (`MonthDays`) and `server/Services/TaskService.cs:57` (`WeekDaysPattern`).

**Vulnerable code** — the validator only checks the pattern string is *non-empty*; it never checks it is numeric:
```csharp
// RecurrenceRulesController.cs:64-65
"MonthDays" => ValidMonthDayModes.Contains(monthDayMode)
    && (monthDayMode != "Specific" || !string.IsNullOrWhiteSpace(monthDays)),
```
Expansion then parses it with the throwing `int.Parse`:
```csharp
// TaskService.cs:132-133
var specificDays = rule.MonthDayMode == "Specific"
    ? (rule.MonthDays ?? "").Split(',', ...).Select(int.Parse).ToHashSet()  // "abc" -> FormatException
```
```csharp
// TaskService.cs:56-57  (WeekCycle)
var days = kv[1].Split(',', ...).Select(int.Parse).ToHashSet();            // "0:abc" -> FormatException
```
(`ParseWeekDayTimes`/`ParseMonthDayTimes` correctly use `TryParse`; these two paths do not. Non-numeric *and* huge values — `"99999999999999999999"` → `OverflowException` — both crash.)

**Input that breaks it:** create a rule with `type:"MonthDays", monthDayMode:"Specific", monthDays:"abc"` (or `type:"WeekCycle", weekDaysPattern:"0:abc"`). The POST **succeeds (200)**.

**Observed:** the rule is stored. Then **every** calendar read for that user — `GET /api/tasks/day` and `GET /api/tasks/period` (the Day and Period views, which call `GetEffectiveOccurrences → GenerateBaseDates`) — returns **500 `System.FormatException: The input string 'abc' was not in a correct format`**. The calendar stays broken on every load until the rule is deleted out-of-band.

**Expected:** reject the pattern at create time (400), or parse defensively with `TryParse` and skip bad tokens.

**Live result (server_poc.sh §F4):**
```
create rule monthDays='abc'           -> 200
GET /api/tasks/day                    -> 500  FormatException: 'abc' ...
GET /api/tasks/period                 -> 500
create rule weekDaysPattern='0:abc'   -> 200
GET /api/tasks/day                    -> 500
```

---

## Finding 2 — NLP quick-add parser is quadratic: a pasted/long string freezes the browser tab

**Severity:** High (client-side denial of service; the whole UI thread is blocked).
**Status:** EXECUTED (`nlp_fuzz.mjs`, `nlp_scaling.mjs`).
**Location:** `client/src/utils/nlp/parser.js` — `parseInput` pipeline (`collect` + `resolveOverlaps` at `:316-328`, plus `buildTitle` `:331-365` and `fuzzyCorrect`). Called synchronously from the Quick-Add screen on submit/typing.

**Input that breaks it:** any long repetitive string — e.g. `"завтра "` repeated, as from a paste or a child holding a key.

**Observed — measured wall-clock blocking time (`nlp_scaling.mjs`):**
```
n=  500  (  3500 chars)    276 ms
n= 1000  (  7000 chars)   1008 ms   (2x input -> 4x time)
n= 2000  ( 14000 chars)   3783 ms
n= 4000  ( 28000 chars)  15243 ms
n= 8000  ( 56000 chars)  61943 ms   (~62 seconds frozen)
```
Doubling the input quadruples the time — clean **O(n²)**. A ~56 KB paste freezes the single JS thread for **over a minute** (no Web Worker; the entire SPA is unresponsive). Other repeated-token inputs in `nlp_fuzz.mjs` reproduce it: `"субботу "×3000` → **8.6 s**, `"суботи x "×3000` → **9.0 s**.

**Expected:** cap input length before parsing (the field has no `maxLength`), and/or make the matcher/overlap resolution linear. There is a defensive length guard *nowhere* in the parser or the Quick-Add page.

**Note:** short garbage is fine (punctuation, emoji, RTL, numbers-only all return in <50 ms as a low-confidence raw task) — the problem is purely length × repetition.

---

## Finding 3 — `GET /api/finance/stats` 500s on a bad or missing `year`

**Severity:** High (the Finance statistics screen; trivially reachable).
**Status:** EXECUTED.
**Location:** `server/Controllers/FinanceController.cs:36-41` (`[FromQuery] int year`, no validation) → `server/Services/FinanceService.cs:76-79`.

**Vulnerable code:**
```csharp
// FinanceService.cs:77-79
if (month is < 1 or > 12) month = 1;          // month IS clamped...
var start = new DateTime(year, month, 1);     // ...year is NOT -> throws for year<1 or >9999
var end = start.AddMonths(1);
```
`year` is a non-nullable value type bound from the query string, so an omitted `year` **defaults to 0**, and `new DateTime(0, 1, 1)` throws.

**Input that breaks it:** `GET /api/finance/stats` (no params), or `?year=0`, or `?year=99999`.

**Observed:** **500 `System.ArgumentOutOfRangeException: Year, Month, and Day parameters describe an un-representable DateTime`** (full stack trace in body). `?year=2026&month=5` → 200.

**Expected:** validate/clamp `year` to `1..9999` (as `month` already is) and return 400 on nonsense.

**Live result (server_poc.sh §F1):**
```
stats                      -> 500
stats?year=0&month=1       -> 500
stats?year=99999&month=1   -> 500
stats?year=2026&month=5    -> 200
```

---

## Finding 4 — `SetLimit` and `receipt-total` don't clamp money → 500 on large amounts

**Severity:** High (unhandled DB exception; inconsistent with the rest of the module).
**Status:** EXECUTED.
**Location:**
- `server/Services/FinanceService.cs:123-135` (`SetLimitAsync` — `limit.Amount = amount;` with **no** `ClampMoney`).
- `server/Services/ShoppingService.cs:228-262` (`ApplyReceiptTotalAsync` — `Amount = total` with no clamp).
- Column type: all `decimal` are `decimal(18,2)` (`server/Data/AppDbContext.cs:88`).

The module *already knows* money must be clamped — `AddTransactionAsync`/`SetBalanceAsync` call `ClampMoney` (`FinanceService.cs:31`, range `0 … 1e9`). `SetLimitAsync` and the receipt split simply forgot, so a value with more than 16 integer digits overflows `decimal(18,2)`.

**Input that breaks it:**
- `PUT /api/finance/limit` `{"periodType":"Week","amount":100000000000000000}` (1e17).
- `POST /api/shopping-list/receipt-total` `{"total":100000000000000000}` (1e17; the controller only guards `total < 0`).

**Observed:** **500 `Microsoft.EntityFrameworkCore.DbUpdateException`** (MySQL "Out of range value") for both.

**Expected:** clamp/validate the amount (reuse `ClampMoney`) and return 400.

**Live result (server_poc.sh §F2–F3):** both `-> 500`.

---

## Finding 5 — `GET /api/tasks/free-days` loops over an unbounded date range

**Severity:** Medium (CPU DoS on wide ranges; hard 500 at the extreme).
**Status:** EXECUTED.
**Location:** `server/Controllers/TasksController.cs:43-49` (only guards `from > to`) → `server/Services/TaskService.cs:322` (`for (var d = from; d <= to; d = d.AddDays(1))` — no span cap).

Unlike recurrence rules (capped to 1 year by `IsValidRule`), the free-days endpoint iterates one day at a time across whatever range the client sends, doing per-day LINQ work. A wide range (a child spinning the year picker) burns CPU proportionally; the absolute extreme additionally crashes.

**Input that breaks it:** `GET /api/tasks/free-days?from=0001-01-01&to=9999-12-31&minHours=2`.

**Observed:** **500 `System.ArgumentOutOfRangeException` from `DateOnly.AddDays`** — the loop walks `d` up to `DateOnly.MaxValue`, then `d.AddDays(1)` overflows (`TaskService.cs:322`). A merely *large* range (e.g. 2000–2099 ≈ 36 k iterations) returns 200 but runs the unbounded loop (≈140 ms with no tasks; multiplies with task volume).

**Expected:** cap the queryable span (e.g. reject ranges beyond a year or a few years) and iterate safely near `DateOnly.MaxValue`.

---

## Finding 6 — NLP parser throws on non-string input (no type guard)

**Severity:** Low (UI always passes a string today, but there is no defensive guard).
**Status:** EXECUTED (`nlp_fuzz.mjs`).
**Location:** `client/src/utils/nlp/parser.js:755` — `const raw0 = normalizeApostrophes((text || '').trim())`.

`(text || '')` only rescues falsy values; a number, object, or array passes through and `.trim()` throws.

**Observed:**
```
CRASH  number instead of string  -> TypeError: (text || "").trim is not a function
CRASH  object instead of string  -> TypeError: ...
CRASH  array  instead of string  -> TypeError: ...
```
Empty/`null`/`undefined`/whitespace are handled gracefully (0 tasks). **Expected:** coerce with `String(text ?? '')`.

---

## Finding 7 — `SetLimit` accepts negative spending limits

**Severity:** Low (data integrity / logic, not a crash).
**Status:** EXECUTED.
**Location:** `server/Services/FinanceService.cs:123-135` — no sign check on `amount`.

`PUT /api/finance/limit {"periodType":"Month","amount":-5000}` → **200**; a negative budget limit is stored, making every expenditure instantly "over limit". **Expected:** reject amounts `< 0`.

---

## Finding 8 — No `HasMaxLength`: strings are `longtext`, but indexed strings become `varchar(255)`

**Severity:** Low.
**Status:** CODE-CONFIRMED (column types verified live via `SHOW COLUMNS`; the >255 overflow itself not driven).
**Location:** `server/Data/AppDbContext.cs` — no `HasMaxLength(...)` anywhere; only `HavePrecision(18,2)` for decimals (`:88`).

Consequence of Pomelo defaults: unindexed string columns map to `longtext` (so `Nickname`, `PasswordHash`, `CustomText`, finance `Description`/`Category`, etc. accept arbitrarily long input with **no truncation error** — data-bloat, not a crash). But columns inside an index are capped at `varchar(255)` (verified: `Users.Email` is `varchar(255)`). `FinanceHiddenCategory.CategoryKey` sits in a **unique index** (`AppDbContext.cs:258`), so a category key longer than 255 chars via `PUT /api/finance/categories/{key}/hidden` risks a MySQL length error (500) or silent truncation. **Expected:** explicit `HasMaxLength` on user-facing strings + server-side length validation.

---

## Finding 9 — Control chars, RTL overrides, emoji and `<script>` text are stored verbatim (stored-XSS surface)

**Severity:** Low/Info (no crash; flagged per brief for the XSS section).
**Status:** EXECUTED (parser) + CODE-CONFIRMED (storage).
**Location:** `client/src/utils/nlp/parser.js` (title building does not strip control/formatting chars) → `TasksController.Create` (`server/Controllers/TasksController.cs:80-94`, only `IsNullOrWhiteSpace(Title)` checked) → stored in `longtext` unchanged.

`nlp_fuzz.mjs` shows the parser happily returns titles containing NUL/`` control chars, a zero-width + RTL-override sequence (`"test ​‮task"`), raw emoji, and arbitrary markup — all become a task `title` that the API accepts and persists as-is. Whether this becomes executable XSS depends on React render paths/`dangerouslySetInnerHTML` (out of scope here) — but the ingestion side performs **no sanitization or normalization**. Covered further in the XSS section; noted here because the fool/child is the one who pastes it.

---

## Negative controls (tested, NOT vulnerable — for honesty)

- `POST /api/tasks` with `startDateTime:"0001-01-01T00:00:00"` → **200** (MySQL accepted it; no datetime-range crash). Hypothesis dropped.
- `POST /api/auth/login` / `send-code` with missing fields (`{}`) → **400** with a proper validation payload, not 500: ASP.NET's non-nullable reference-type model validation auto-rejects omitted `string` record fields. The `request.Email.Trim()` NRE hypothesis is therefore **invalid**. (Value types like `int year` in Finding 3 are *not* covered by that guard — which is exactly why F3 bites.)
- `AddTransaction` / `SetBalance` large/negative amounts → safely clamped by `ClampMoney` (no crash).
- `GetStats` `month` out of range → clamped to 1 (no crash). Recurrence ranges are capped to 1 year by `IsValidRule`, so rule expansion is not itself a DoS vector (only free-days, Finding 5, is).
- Short NLP garbage (punctuation, emoji, numbers-only, RTL, mixed language, keyboard mash) → handled, returns a low-confidence raw task in <50 ms.

---

## How to reproduce

```bash
# Client parser (Node; no server needed)
node adversarial-review/poc/robustness/nlp_fuzz.mjs
node adversarial-review/poc/robustness/nlp_scaling.mjs

# Server (API on :5080 + planner-mysql up). Creates & cleans up its own throwaway user.
bash adversarial-review/poc/robustness/server_poc.sh
```
No existing application source file was modified. The server PoC operates on an isolated user (`adv_robustness_poc@gmail.com`) and deletes it and its data on completion.
