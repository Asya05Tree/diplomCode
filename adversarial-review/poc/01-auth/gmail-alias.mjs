// §9: Gmail alias/dot normalization not performed -> one mailbox = many accounts,
// bypasses email_taken and any per-account free-tier limit.
import { api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'
const sql = (q) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', q], { encoding: 'utf8' }).trim()
const readCode = (e) => sql(`SELECT Code FROM EmailVerificationCodes WHERE Email='${e}' AND IsUsed=0 ORDER BY Id DESC LIMIT 1;`).split(/\s+/).pop()

const variants = ['adv.t01.alias@gmail.com', 'a.d.v.t01.alias@gmail.com', 'adv.t01.alias+promo@gmail.com']
for (const e of variants) { sql(`DELETE FROM EmailVerificationCodes WHERE Email='${e}';`); sql(`DELETE FROM UserProfiles WHERE UserId IN (SELECT Id FROM Users WHERE Email='${e}');`); sql(`DELETE FROM Users WHERE Email='${e}';`) }

let created = 0
for (const e of variants) {
  const sc = await api('POST', '/api/auth/send-code', { body: { email: e, nickname: 'Alias' } })
  if (sc.status !== 200) { console.log(`[alias] ${e} send-code -> ${sc.status} ${sc.text}`); continue }
  const code = readCode(e)
  const reg = await api('POST', '/api/auth/register', { body: { nickname: 'Alias', gender: 'female', email: e, code, password: 'Passw0rd!', studentType: 'none', isWorking: false } })
  console.log(`[alias] register ${e} -> ${reg.status}`)
  if (reg.status === 200) created++
}
console.log(created === variants.length
  ? `CONFIRMED: ${created}/${variants.length} distinct accounts created for aliases of the SAME Gmail mailbox (dots + "+tag" not normalized; only Trim().ToLowerInvariant()). Bypasses email_taken and the per-account free quota.`
  : `partial: ${created}/${variants.length} created`)
