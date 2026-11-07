// §9 / §11 — PlanTripAsync creates a NEW "Купити за списком" task on every call,
// with no dedup/guard. N clicks => N tasks in Unassigned.
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

const A = await provision({ email: 'adv.t05.trip@gmail.com' })
const db = (sql) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', sql], { encoding: 'utf8' }).trim()

const N = 5
const ids = []
for (let i = 0; i < N; i++) ids.push((await api('POST', '/api/shopping-list/plan-trip', { token: A.token })).json.taskId)
console.log(`plan-trip x${N} -> taskIds ${ids.join(', ')}`)

// match on ASCII SourceModule (Cyrillic literals don't survive `docker exec -e`).
const count = Number(db(`SELECT COUNT(*) FROM Tasks WHERE UserId=${A.userId} AND SourceModule='shopping';`))
console.log(`"Купити за списком" tasks in DB = ${count} (expected 1 with dedup)`)
console.log(count >= N
  ? `CONFIRMED: ${N} clicks -> ${N} duplicate tasks (DB holds ${count}, cumulative across reruns); no "already open trip" check (ShoppingService.cs:266-272).`
  : 'REFUTED')
