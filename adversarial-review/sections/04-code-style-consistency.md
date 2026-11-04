# 04 — Code Style & Consistency Audit

**Scope:** Adversarial audit of style self-consistency across `server/` (ASP.NET Core 8 + EF Core, C#) and `client/` (React 19 + Vite, plain JS), measured against the project's own style contract `plans/coding-guide.md`.

**Thesis under test:** "The codebase is a single, self-consistent style." This audit set out to disprove it.

**Verdict (short):** The project is **mostly consistent, with a thin layer of real divergences that betray its incremental history.** The *disciplines the guide emphasizes most* (Ukrainian comments, English identifiers, DTO mapping, `userId`-first services, two-language-only i18n with synced key sets) hold up remarkably well. But a handful of **structural inconsistencies** — two parallel HTTP layers on the client, a service-vs-direct-DbContext split on the server, hardcoded Ukrainian UI strings, and CSS-per-component applied to only half the modules — mean an examiner can correctly say the codebase is **"consistent in the large, mixed in the seams."** It is not "one uniform style" end to end.

Below, each finding gives the majority convention (with ≥2 conforming examples) and the deviations with `file:line`.

---

## PART A — SERVER (C#)

### A1. How controllers read the current user — MOSTLY CONSISTENT (one benign outlier)

**Majority convention:** a private expression-bodied property
`private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);`
declared once per controller.

Conforming (16 controllers), e.g.:
- `server/Controllers/FinanceController.cs:27`
- `server/Controllers/CycleController.cs:26`
- `server/Controllers/TodoController.cs:29`
- `server/Controllers/NotesController.cs:28`
- `server/Controllers/MediaController.cs:53`

**Deviation:**
- `server/Controllers/AuthController.cs:135` — does the parse **inline** inside `Me()`:
  `var userId = int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);`
  AuthController is the only authenticated-reading controller that does **not** define the `CurrentUserId` helper.

**Impact:** Low. One-off; defensible (Auth is a special case). But it does mean the "sub-claim helper" is not literally universal — the parsing logic is duplicated in two shapes.

---

### A2. Route declaration — INCONSISTENT token usage

**Majority convention:** explicit literal kebab-case route on the controller:
- `server/Controllers/FinanceController.cs:16` → `[Route("api/finance")]`
- `server/Controllers/MedicineCabinetController.cs:14` → `[Route("api/medicine-cabinet")]`
- `server/Controllers/HealthProfileController.cs:18` → `[Route("api/health-profile")]`

**Deviations:**
- `server/Controllers/HealthController.cs:9` → `[Route("api/[controller]")]` — the **only** controller using the `[controller]` token convention instead of a literal string. (It also happens to resolve to `api/Health`, PascalCase, breaking the all-lowercase route style.)
- `server/Controllers/BillingController.cs:14` → `[Route("api")]` with **full paths repeated per action** (`[HttpGet("quick-add/status")]`, `[HttpPost("billing/checkout")]` at lines 28/46). It is the only controller hosting two unrelated resource prefixes (`quick-add/*` and `billing/*`) under one empty base route.

**Impact:** Medium for a defense. Two different route-declaration philosophies coexist (literal-per-controller vs token vs empty-base-with-full-action-paths). An examiner scanning `[Route(...)]` attributes sees three patterns.

---

### A3. Service layer vs. direct `AppDbContext` in controllers — INCONSISTENT (the biggest server split)

The guide (§2/§3) forbids repositories and blesses "direct EF on AppDbContext," so direct DB access is *allowed*. The **inconsistency** is that structurally-similar CRUD modules are split down the middle on whether they get a service at all.

**Pattern 1 — controller delegates everything to an injected `XxxService`:**
- `server/Controllers/FinanceController.cs` → `_financeService`
- `server/Controllers/CycleController.cs` → `_cycleService`
- `server/Controllers/StudyController.cs` → `_studyService`
- also Food, MedicineCabinet, Work, Checkup, Tasks, ShoppingList, RecurrenceRules, Billing.

**Pattern 2 — controller talks to `AppDbContext` directly, no service:**
- `server/Controllers/NotesController.cs:21,34,43,60` (`_db.Notes...`) — comment at line 12 even justifies it.
- `server/Controllers/TodoController.cs:22,34,49,64` (`_db.TodoItems...`) — comment at line 13 justifies it.
- `server/Controllers/HealthProfileController.cs:34,44,68,93` (`_db.UserProfiles` / `_db.UserTagPreferences...`).

**Pattern 3 — hybrid: a controller that uses BOTH a service and raw `_db` in the same file:**
- `server/Controllers/MediaController.cs` — raw `_db.MediaItems` (lines 132,148,170,205) **and** injected `_tasks` service (`CreateTaskAsync`/`DeleteTaskAsync`, lines 96,117,122,283).
- `server/Controllers/AccountController.cs` — injected `_account` service (lines 37,57,66) **and** raw `_db.Users` (line 73).

**Impact:** High for "uniform architecture" claims. Three modules (Notes, Todo, HealthProfile) have business logic living in the controller while their peers (Finance, Cycle, Study…) have it in a service. Reviewer question "where does the logic for module X live?" has no single answer — it depends on the module.

---

### A4. Return types — CONSISTENT (positive), but action-body style is split

**Positive:** every action in every controller returns `Task<IActionResult>` (or `IActionResult`). No mix of `ActionResult<T>` vs raw `T` vs `IActionResult`. This axis is genuinely uniform.

**Sub-inconsistency — expression-bodied vs block-bodied actions:**
- Expression-bodied `=> Ok(await …)` is the house style in Study/Work/Checkup: `server/Controllers/StudyController.cs` (12 such actions), `server/Controllers/WorkController.cs` (18), `server/Controllers/CheckupController.cs:27,38`.
- Block-bodied `{ … return Ok(…); }` is the house style in Finance/Cycle/Food/Media/Notes.

**Impact:** Low–medium. Both compile identically; it is purely cosmetic, but it is visible — older modules use block bodies, the newest modules (Study/Work, per migration dates) use expression bodies.

---

### A5. DTO usage — CONSISTENT no-leak (positive), inconsistent DTO *placement*

**Positive:** services map EF entities to purpose-built DTOs and return those, not entities:
- `server/Services/FinanceService.cs:33` returns `FinanceDto`
- `server/Services/MedicineService.cs:37` returns `List<CabinetItemDto>`
- `server/Services/CheckupService.cs:23` returns `List<VisitDto>`
No controller was found returning a bare EF entity; read endpoints project (`TodoController.cs:38` projects to an anonymous type, `NotesController.cs:37` projects to `NoteDto`). Good discipline overall.

**Inconsistency — where DTOs/records are declared:**
- Request records are declared **top-of-file, outside the controller class**: `FoodController.cs:8`, `FinanceController.cs:9`, `TodoController.cs:10-11`, `MedicineCabinetController.cs:8-9`.
- But response DTOs live in different places: **nested inside the controller class** (`NotesController.cs:30` — `public record NoteDto(...)`) vs **inside the service file** (Finance/Medicine/Checkup DTOs). There is no single rule for "where a DTO is defined."

**Impact:** Low–medium. Finding the shape of a payload requires knowing which of three locations the author happened to pick.

---

### A6. Request-body parameter naming — INCONSISTENT (`request` vs `r`)

**Two competing conventions, roughly even split:**
- `request`: `FinanceController.cs:44,51,58`, `CycleController.cs:36`, `FoodController.cs:35`, `AuthController.cs:41,67`, `MediaController.cs:139`.
- `r` (single letter): `CheckupController.cs:30`, `NotesController.cs:41,58`, `StudyController.cs:53,66`, `WorkController.cs:43,57`, `BillingController.cs:59`.

**Impact:** Low, but it is the clearest "two authors / two eras" tell on the server. Newer modules (Checkup/Notes/Study/Work/Billing) abbreviate to `r`; older modules spell `request`.

---

### A7. Comment language — CONSISTENT (positive, matches guide §2)

The guide mandates Ukrainian explanatory comments with English identifiers. This holds up extremely well. Sampled comments are Ukrainian prose:
- `server/Controllers/CycleController.cs:13`, `server/Services/FinanceService.cs:7`, `server/RuleEngine/TagMatcher.cs:3`, `server/Models/Food.cs:7`.
English fragments that appear in comments are only technical tokens/value enumerations (`// Available | RunningLow | OutOfStock` at `Models/Food.cs:81`, `// orderReference …`), not English prose. **No English explanatory comments were found.** Identifiers are uniformly English. This is a strong consistency point in the project's favour.

---

## PART B — CLIENT (JS / React)

### B1. API layer — INCONSISTENT (three HTTP styles; the headline client finding)

**Majority convention:** import the shared wrapper and call `apiGet`/`apiSend` from `src/api/http.js` (token read internally from `localStorage`):
- `client/src/api/finance.js:2`, `cycle.js:2`, `healthProfile.js:2`, `billing.js:3`, `checkup.js:2`, `media.js:4`, `food.js:4`, `medicineCabinet.js:3`, `shopping.js:2`, `notes.js:2`, `study.js:4`, `work.js:3` — **12 modules** on the shared wrapper.

**Deviations:**
1. `client/src/api/tasks.js:4-21` — **defines its own private `apiGet`/`apiSend`** duplicating `http.js`, but with a **different signature**: the token is threaded as an explicit argument (`getDayTasks(token, date)` at line 25; `apiGet(path, token)` at line 4) instead of read from storage. `http.js:1-3`'s own comment admits it was extracted from `tasks.js` "so as not to duplicate in every module" — yet `tasks.js` was never migrated to it. Two HTTP abstractions with incompatible calling conventions coexist.
2. `client/src/api/client.js:18-57` — the auth module calls `fetch` **directly** (sendCode/register/login/getMe), never using the wrapper.
3. `client/src/api/account.js:3-8` — imports `apiSend` but still drops to raw `fetch` for `exportData()` (blob download).

**Impact:** High. A new call site must first discover *which* of three conventions its module uses (token-passed vs token-implicit vs raw fetch). This is the single most defensible "the client is not one style" claim.

---

### B2. Error handling — INCONSISTENT across the same API layer

**Majority convention:** `throwApiError(response)` throws an `Error` whose `message` is the backend error **code** (`invalid_email`, `email_taken`…), so forms can translate it — `client/src/api/client.js:13-16`, used by every `http.js` call and by `tasks.js:8,18`.

**Deviation (same file, different functions):**
- `client/src/api/client.js:43-45` (`login`) and `client.js:52-55` (`getMe`) throw a **generic English template string**: `` throw new Error(`login failed: ${response.status}`) `` and `` `me failed: ${response.status}` ``. These bypass `throwApiError`, so the thrown message is untranslatable English, unlike `sendCode`/`register` directly above them (lines 24,33) which *do* use `throwApiError`.

**Impact:** Medium. Inconsistent even within a single 57-line file — two auth calls can surface raw English error text while the rest of the app surfaces translatable codes.

---

### B3. i18n coverage — CONSISTENT key sets (positive), but hardcoded UI strings leak through

**Positive (strong):** `uk.json` and `en.json` are **perfectly in sync — 997 keys each, zero keys missing on either side, zero empty values.** The `t(key, params)` helper (`client/src/i18n/index.jsx:59-67`) is used pervasively, including for tooltips (`data-tooltip={t(...)}` appears in 13 components). Two-language-only rule (guide §3) is respected — no third language stub.

**Deviations — user-facing Ukrainian strings hardcoded instead of via `t()`:**
- `client/src/pages/Food.jsx:647` → `data-tooltip="Закрити"`
- `client/src/pages/Food.jsx:728` → `aria-label="Закрити" data-tooltip="Закрити"`
- `client/src/components/planner/MonthGrid.jsx:38` → `data-tooltip="Попередній місяць"`
- `client/src/components/planner/MonthGrid.jsx:48` → `data-tooltip="Наступний місяць"`
- `client/src/components/Sidebar.jsx:54` → `data-tooltip="Скоро"` ("Soon")

(`"Всетута"` brand text at `Sidebar.jsx:41` / `Landing.jsx:221` is a proper noun — acceptable.)

**Impact:** Medium. These five strings will **not switch to English** when the user picks English, while the surrounding UI does — a visible correctness/consistency defect that directly contradicts the "all user-facing text via i18n" intent. Small in count, but each is a live bug in the English locale.

---

### B4. CSS-per-component — INCONSISTENT (applied to only ~half the component tree)

**Majority convention (planner + top-level components):** each component ships a sibling `.css`:
- `components/planner/TaskItem.jsx` + `TaskItem.css`
- `components/planner/DayView.jsx` + `DayView.css`
- `components/planner/MonthGrid.jsx` + `MonthGrid.css`
- `components/CodeInput.jsx` + `CodeInput.css`, `components/Sidebar.jsx` + `Sidebar.css`.

**Deviations — whole module folders with NO component CSS (they rely on the page-level stylesheet):**
- `components/study/` — 7 components (`SubjectsTab.jsx`, `ScheduleTab.jsx`, `DebtsTab.jsx`, …) and **no `.css` file at all**; they lean on `pages/Study.css`.
- `components/work/` — 6 components (`ObligationsTab.jsx`, `ProcessTab.jsx`, `ContactsTab.jsx`, …) and **no `.css` file**; they lean on `pages/Work.css`.
- `components/notes/Board.jsx` — no `Board.css`; uses `pages/Notes.css`.
- `components/common/ComboList.jsx` — no `ComboList.css`.

**Impact:** Medium. The co-located-CSS discipline is real for the planner era but was abandoned for the Study/Work/Notes era (styles centralized in page CSS). Two opposing styling architectures in one `components/` tree.

---

### B5. Component model, semicolons, identifiers — CONSISTENT (positives)

- **Function components only:** zero `class … extends Component` found across `client/src`. Hooks-based throughout.
- **Semicolons:** the codebase is uniformly **no-semicolon** (ASI) JS. Every line-ending `;` found in `.js/.jsx` sits **inside Ukrainian comment prose** (e.g. `parser.js:4-7`, `Finance.jsx:64`), not after statements — so this axis is actually clean.
- **Identifiers English, comments Ukrainian:** matches the server and the guide. Ukrainian appears in comments and (the few) hardcoded strings, never in identifiers.

**Impact:** Positive — these back the "mostly consistent" side of the verdict.

---

### B6. Minor — page/module naming mismatch

The media module is `Media` on the server (`MediaController`, `api/media.js`, `MediaItem`) but the page is `client/src/pages/Watchlist.jsx` (route/title "Watchlist"). The client page name diverges from the module name used everywhere else in the stack.

**Impact:** Low. One cross-cutting naming seam; a reader grepping "Media" will not find the page.

---

## OVERALL VERDICT

**Not "one consistent style" — it is "consistent core, inconsistent seams."**

Quantified:

| Axis | Status | Weight |
|---|---|---|
| Ukrainian comments / English identifiers (both tiers) | ✅ Consistent | guide-critical |
| Services return DTOs, no entity leaks | ✅ Consistent | high |
| `userId`-first `…Async` service signatures | ✅ Consistent | high |
| `IActionResult` return type (server) | ✅ Consistent | medium |
| i18n: two languages, uk/en key sets (997≡997) | ✅ Consistent | high |
| Function components + hooks, no-semicolon JS | ✅ Consistent | medium |
| **Client HTTP layer (3 styles: http.js / own wrapper / raw fetch)** | ❌ Inconsistent | **high** |
| **Service vs direct-DbContext per module** | ❌ Inconsistent | **high** |
| **CSS-per-component (half the tree only)** | ❌ Inconsistent | medium |
| **Hardcoded Ukrainian UI strings (5 sites)** | ❌ Inconsistent / i18n bug | medium |
| Route declaration (literal vs token vs empty-base) | ⚠️ Inconsistent | medium |
| Request param naming (`request` vs `r`) | ⚠️ Inconsistent | low |
| Action body style (expression vs block) | ⚠️ Inconsistent | low |
| Error handling (throwApiError vs generic English) | ⚠️ Inconsistent | medium |

**Roughly 6 solid consistency wins vs. ~8 divergences**, of which **4 are structural** (HTTP layer, service split, CSS strategy, i18n leakage) and the rest cosmetic. The pattern is textbook **archaeology**: the oldest modules (Tasks, planner) set one set of conventions (own HTTP wrapper with token-passing, block-bodied actions, co-located CSS, `request` params), and the newest modules (Study, Work, Checkup, Notes, Billing — per migration timestamps) adopted different ones (shared `http.js`, expression-bodied actions, page-level CSS, `r` params). Nothing was retro-fitted.

**Defense risk:** An examiner who asks "show me how a module makes an HTTP call" or "where does module X's business logic live?" will get a *different answer per module* — the strongest, most defensible inconsistency claims. The hardcoded Ukrainian tooltips are the easiest to demonstrate live (switch UI to English → those tooltips stay Ukrainian).
