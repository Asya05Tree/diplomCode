// §9: Gmail alias/dot normalization. ПЛАН P2-6 (fixed): сервер канонізує email (прибирає крапки та
// "+suffix" для gmail), тож усі аліаси однієї скриньки = ОДИН акаунт (email_taken + одна квота).
import { api, normalizeEmail } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'
const sql = (q) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', q], { encoding: 'utf8' }).trim()
const readCode = (e) => sql(`SELECT Code FROM EmailVerificationCodes WHERE Email='${normalizeEmail(e)}' AND IsUsed=0 ORDER BY Id DESC LIMIT 1;`).split(/\s+/).pop()

const variants = ['adv.t01.alias@gmail.com', 'a.d.v.t01.alias@gmail.com', 'adv.t01.alias+promo@gmail.com']
// Чистимо за КАНОНІЧНИМ email (сервер зберігає саме його), інакше залишки від прогонів заважають.
const canon = normalizeEmail(variants[0])
sql(`DELETE FROM EmailVerificationCodes WHERE Email='${canon}';`)
sql(`DELETE FROM UserProfiles WHERE UserId IN (SELECT Id FROM Users WHERE Email='${canon}');`)
sql(`DELETE FROM Users WHERE Email='${canon}';`)

let created = 0
for (const e of variants) {
  const sc = await api('POST', '/api/auth/send-code', { body: { email: e, nickname: 'Alias' } })
  const code = readCode(e)
  const reg = await api('POST', '/api/auth/register', { body: { nickname: 'Alias', gender: 'female', email: e, code, password: 'Passw0rd!', studentType: 'none', isWorking: false } })
  console.log(`[alias] ${e} -> send-code ${sc.status}, register ${reg.status} ${reg.status !== 200 ? reg.json?.error : ''}`)
  if (reg.status === 200) created++
}
const accounts = Number(sql(`SELECT COUNT(*) FROM Users WHERE Email='${canon}';`))
console.log(`\nDistinct accounts for canonical ${canon}: ${accounts} (created this run: ${created})`)
console.log(accounts <= 1 && created <= 1
  ? `REFUTED: ${variants.length} aliases of the same mailbox collapse to a single account (dots + "+tag" normalized). email_taken and per-account quota hold.`
  : `CONFIRMED: ${accounts} distinct accounts created for aliases of the SAME Gmail mailbox.`)
