// §6/§7/§8 — wipe/delete re-auth + ownership + rate-limit.
//   - wipe/delete verify the password server-side (BCrypt) → wrong pwd = 400 (§7 ✅)
//   - target user is CurrentUserId from JWT, NOT a body field → cannot name another user (§7 ✅)
//   - NO rate-limit / lockout: unlimited wrong-password attempts all return 400 (§6/§8 🟠)
//   - status codes: wipe 200/400, delete 400 on wrong pwd (§6 ✅)
import { provision, mintToken, api } from '../_lib/provision.mjs'
import { db } from './_db.mjs'

const victim = await provision({ email: 'adv.t13.acc.victim@gmail.com' })
// give victim a task so we can prove wipe didn't fire on wrong password
await api('POST', '/api/tasks', { token: victim.token, body: { title: 'keep-me', date: '2030-01-01' } }).catch(() => {})

// --- A) wipe with WRONG password → 400, data intact ---
const w = await api('POST', '/api/account/wipe', { token: victim.token, body: { password: 'wrong-pass' } })
const tasksAfter = db(`SELECT COUNT(*) FROM Tasks WHERE UserId=${victim.userId};`)[0][0]
console.log(`A) wipe wrong pwd: status=${w.status} error=${w.json?.error} tasksRemaining=${tasksAfter}`)

// --- B) attacker can only ever hit their OWN account (no userId in body). Attacker forges a
//        token for the victim's id but does NOT know victim's password → still blocked. ---
const forged = mintToken(victim.userId, 'attacker@gmail.com')
const fdel = await api('POST', '/api/account/delete', { token: forged, body: { password: 'guessing' } })
console.log(`B) delete victim via forged token + wrong pwd: status=${fdel.status} error=${fdel.json?.error} (password is the barrier)`)

// --- C) NO rate-limit: 12 rapid wrong-password attempts, expect ALL 400, no lockout/429 ---
let statuses = []
for (let i = 0; i < 12; i++) {
  const r = await api('POST', '/api/account/wipe', { token: victim.token, body: { password: `bad${i}` } })
  statuses.push(r.status)
}
const all400 = statuses.every((s) => s === 400)
const anyLockout = statuses.some((s) => s === 429)
console.log(`C) 12 wrong-password wipe attempts statuses=[${statuses.join(',')}]`)

// --- D) correct password actually wipes (control) ---
const good = await api('POST', '/api/account/wipe', { token: victim.token, body: { password: 'Passw0rd!' } })
const tasksAfterGood = db(`SELECT COUNT(*) FROM Tasks WHERE UserId=${victim.userId};`)[0][0]
console.log(`D) wipe correct pwd: status=${good.status} tasksRemaining=${tasksAfterGood}`)

console.log('\n==== RESULT ====')
console.log(`Wrong password rejected 400, data intact (§7 ✅): ${w.status === 400 && tasksAfter === '1' ? 'CONFIRMED' : 'see output'}`)
console.log(`Forged token + wrong pwd blocked (§7 ✅): ${fdel.status === 400 ? 'CONFIRMED — password barrier holds' : 'BROKEN'}`)
console.log(`No rate-limit / lockout on password verify (§6/§8 🟠): ${all400 && !anyLockout ? 'CONFIRMED (BROKEN — unlimited attempts)' : 'see output'}`)
console.log(`Correct password wipes content (§6 ✅): ${good.status === 200 && tasksAfterGood === '0' ? 'CONFIRMED' : 'see output'}`)
