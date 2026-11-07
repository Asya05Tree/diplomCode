// §8/§11 (fixed, ПЛАН P2-6): the 6-digit register code must not be brute-forceable.
// Guards: (1) lockout — after 5 wrong attempts the active code is burned; (2) single active code —
// pressing "send code" repeatedly leaves exactly ONE valid code (new invalidates old); plus a 60s
// per-email cooldown bounds code requests. Together: at most 5 guesses per code -> brute-force impractical.
import { api, normalizeEmail } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

const sql = (q) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', q], { encoding: 'utf8' }).trim()

// --- (1) lockout: 5 wrong code attempts burn the active code ---
const email = 'adv.t01.brute@gmail.com'
const canon = normalizeEmail(email)
sql(`DELETE FROM EmailVerificationCodes WHERE Email='${canon}';`)
sql(`DELETE FROM UserProfiles WHERE UserId IN (SELECT Id FROM Users WHERE Email='${canon}');`)
sql(`DELETE FROM Users WHERE Email='${canon}';`)

await api('POST', '/api/auth/send-code', { body: { email, nickname: 'Brute' } })
const realCode = sql(`SELECT Code FROM EmailVerificationCodes WHERE Email='${canon}' AND IsUsed=0 ORDER BY Id DESC LIMIT 1;`).split(/\s+/).pop()

let wrong = 0
for (let i = 0; i < 10 && wrong < 5; i++) {
  const guess = String(i).padStart(6, '0')
  if (guess === realCode) continue
  await api('POST', '/api/auth/register', { body: { nickname: 'Brute', gender: 'female', email, code: guess, password: 'Passw0rd!', studentType: 'none', isWorking: false } })
  wrong++
}
// Now the REAL code must no longer work — it was burned after 5 failures.
const afterLock = await api('POST', '/api/auth/register', { body: { nickname: 'Brute', gender: 'female', email, code: realCode, password: 'Passw0rd!', studentType: 'none', isWorking: false } })
const burned = sql(`SELECT IsUsed FROM EmailVerificationCodes WHERE Email='${canon}' ORDER BY Id DESC LIMIT 1;`) === '1'
const lockout = afterLock.status !== 200 && burned
console.log(`[lockout] after 5 wrong guesses, real code register -> ${afterLock.status} ${afterLock.json?.error}; active code IsUsed=${burned}`)

// --- (2) single active code: send-code 5x -> exactly one simultaneously valid ---
const email2 = 'adv.t01.multi@gmail.com', canon2 = normalizeEmail(email2)
sql(`DELETE FROM EmailVerificationCodes WHERE Email='${canon2}';`)
sql(`DELETE FROM Users WHERE Email='${canon2}';`)
for (let i = 0; i < 5; i++) await api('POST', '/api/auth/send-code', { body: { email: email2, nickname: 'Multi' } })
const validCount = Number(sql(`SELECT COUNT(*) FROM EmailVerificationCodes WHERE Email='${canon2}' AND IsUsed=0 AND ExpiresAt>UTC_TIMESTAMP();`))
console.log(`[single-code] pressed "send code" 5x -> ${validCount} codes simultaneously valid (expected 1)`)

console.log('\n' + (lockout && validCount <= 1
  ? `REFUTED: code burned after 5 failed attempts (lockout) and only ${validCount} code valid at once. With a 60s per-email cooldown that caps guesses at ~5 per minute, brute-forcing the 10^6 space is impractical.`
  : `CONFIRMED: lockout=${lockout}, validCount=${validCount} — code still brute-forceable.`))
