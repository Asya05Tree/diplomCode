// §3/§9 leave end<start silently swapped (no error) + §6/§11 GET /settings writes a row
// (non-idempotent GET with a DB side effect) for a brand-new user.
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'
const line = (s) => console.log(s)
const ok = (c) => (c ? 'CONFIRMED' : 'not-as-expected')
const q = (sql) => execFileSync('docker', ['exec','planner-mysql','mysql','-N','-uplanner','-pplanner_dev_password','planner','-e',sql], { encoding: 'utf8' }).trim()

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t10.leave.${tag}@gmail.com`, isWorking: true })
line(`userId=${u.userId}`)

// 1) Leave end < start -> now rejected with 400 (ПЛАН P2-10): no silent swap, nothing stored.
const lv = await api('POST', '/api/work/leaves', { token: u.token, body: {
  type:'vacation', startDate:'2026-12-31', endDate:'2026-12-01' } })
const ls = await api('GET', '/api/work/leaves', { token: u.token })
const count = (ls.json||[]).length
line(`\n[leave end<start] POST status=${lv.status} ${lv.text?.slice(0,60)}; leaves stored=${count}`)
const leaveRefuted = lv.status === 400 && count === 0
line(`  => ${leaveRefuted ? 'REFUTED' : 'CONFIRMED'}: end<start rejected (400 invalid_date_range), not silently swapped (§3/§9).`)

// 2) GET /settings side-effect (ПЛАН P2-3): a fresh user that only READS settings must NOT get a
//    WorkSettings row INSERTed. Prove by a real DB count after the GET.
const u2 = await provision({ email: 'adv.t10.getonly-p23@gmail.com', isWorking: true })
q(`DELETE FROM WorkSettings WHERE UserId=${u2.userId};`) // прибрати залишок від прогонів до фіксу
const before = await api('GET', '/api/work/settings', { token: u2.token })
const rows = Number(q(`SELECT COUNT(*) FROM WorkSettings WHERE UserId=${u2.userId};`))
const getWrites = rows > 0
line(`\n[GET /settings side effect] fresh user ${u2.userId} GET status=${before.status}; WorkSettings rows after GET = ${rows}`)
line(`  => ${getWrites ? 'CONFIRMED: GET inserts a row (non-idempotent GET, §6/§11).' : 'REFUTED: GET did not write (row created only on PUT).'}`)

line(`\n==== VERDICT ====`)
line((leaveRefuted && !getWrites)
  ? `REFUTED: leave end<start rejected (P2-10) and GET /settings no longer writes (P2-3). Both closed.`
  : `CONFIRMED/partial: leaveRefuted=${leaveRefuted} getWrites=${getWrites}.`)
