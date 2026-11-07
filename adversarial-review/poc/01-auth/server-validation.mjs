// §6/§9/§10: server-side validation gaps reachable by direct POST (bypassing the form).
import { api, normalizeEmail } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'
const sql = (q) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', q], { encoding: 'utf8' }).trim()
// Сервер зберігає коди/акаунти під КАНОНІЧНИМ email (gmail без крапок/+suffix) — читаємо/чистимо ним.
const readCode = (e) => sql(`SELECT Code FROM EmailVerificationCodes WHERE Email='${normalizeEmail(e)}' AND IsUsed=0 ORDER BY Id DESC LIMIT 1;`).split(/\s+/).pop()
const clean = (e) => { const c = normalizeEmail(e); sql(`DELETE FROM EmailVerificationCodes WHERE Email='${c}';`); sql(`DELETE FROM UserProfiles WHERE UserId IN (SELECT Id FROM Users WHERE Email='${c}');`); sql(`DELETE FROM Users WHERE Email='${c}';`) }

// --- 1. No server email-format check: "   @gmail.com" trims to "@gmail.com" (empty local part) ---
{
  const sc = await api('POST', '/api/auth/send-code', { body: { email: '   @gmail.com', nickname: 'Fmt' } })
  console.log(`[email-format] send-code "   @gmail.com" (trims to @gmail.com) -> ${sc.status} ${sc.text}  ${sc.status === 200 ? 'CONFIRMED: malformed email accepted by server (client EMAIL_FORMAT regex bypassed)' : ''}`)
  clean('@gmail.com')
}

// --- 2. Gender stored verbatim, no whitelist (unlike studentType) ---
{
  const e = 'adv.t01.gender@gmail.com'; clean(e)
  await api('POST', '/api/auth/send-code', { body: { email: e, nickname: 'Gen' } })
  const code = readCode(e)
  const payload = '<script>alert(1)</script>'
  const reg = await api('POST', '/api/auth/register', { body: { nickname: 'Gen', gender: payload, email: e, code, password: 'Passw0rd!', studentType: 'bogus-value', isWorking: false } })
  const stored = sql(`SELECT Gender FROM UserProfiles WHERE UserId=(SELECT Id FROM Users WHERE Email='${e}');`)
  const st = sql(`SELECT IFNULL(StudentType,'<null>') FROM UserProfiles WHERE UserId=(SELECT Id FROM Users WHERE Email='${e}');`)
  console.log(`[gender] register gender='${payload}' -> ${reg.status}; DB Gender column now = "${stored}"  ${stored === payload ? 'CONFIRMED: arbitrary/unsanitised gender persisted verbatim' : ''}`)
  console.log(`[studentType] sent 'bogus-value' -> DB StudentType = "${st}" (whitelisted to null — good, contrast with gender)`)
}

// --- 3. Nickname of only separators passes regex {2,30} ---
{
  const e = 'adv.t01.nick@gmail.com'; clean(e)
  await api('POST', '/api/auth/send-code', { body: { email: e, nickname: '--' } })
  const code = readCode(e)
  const reg = await api('POST', '/api/auth/register', { body: { nickname: '--', gender: 'female', email: e, code, password: 'Passw0rd!', studentType: 'none', isWorking: false } })
  console.log(`[nickname] register nickname='--' -> ${reg.status}  ${reg.status === 200 ? 'CONFIRMED: an all-separator "empty" nickname is accepted (regex A-Za-z...\\- allows "--","  ")' : ''}`)
}

// --- 4. Oversized email -> DB column is varchar(255); does it 400 cleanly or 500? ---
{
  const local = 'a'.repeat(300)
  const e = `${local}@gmail.com`
  const sc = await api('POST', '/api/auth/send-code', { body: { email: e, nickname: 'Big' } })
  console.log(`[email-len] send-code with ${e.length}-char email -> ${sc.status} ${sc.text.slice(0,160)}  ${sc.status >= 500 ? 'CONFIRMED: unhandled 500 (exceeds varchar(255), no length guard)' : '(handled)'}`)
}

// --- 5. Missing / null required fields: model binding behaviour ---
{
  const r1 = await api('POST', '/api/auth/register', { body: { email: 'adv.t01.null@gmail.com' } }) // most fields absent
  console.log(`[binding] register with missing fields -> ${r1.status} ${r1.text.slice(0,200)}`)
  const r2 = await api('POST', '/api/auth/login', { body: {} })
  console.log(`[binding] login with empty body -> ${r2.status} ${r2.text.slice(0,200)}`)
}
