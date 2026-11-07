// §9 / §11 (fixed, ПЛАН P2-9) — PlanTripAsync is now idempotent: while an open (not Done)
// "Купити за списком" task exists, repeated clicks RETURN THAT task instead of inserting a new one.
// Was: N clicks -> N duplicate tasks in Unassigned.
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

// Унікальний email на прогін: provision при email_taken лише логіниться (не чистить), тож фіксований
// email тягнув би відкриту задачу-похід із попередньої сесії й «1» був би неоднозначним.
const tag = Math.random().toString(36).slice(2, 7)
const A = await provision({ email: `adv.t05.trip.${tag}@gmail.com` })
const db = (sql) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', sql], { encoding: 'utf8' }).trim()

const N = 5
const ids = []
for (let i = 0; i < N; i++) ids.push((await api('POST', '/api/shopping-list/plan-trip', { token: A.token })).json.taskId)
console.log(`plan-trip x${N} -> taskIds ${ids.join(', ')}`)

// match on ASCII SourceModule (Cyrillic literals don't survive `docker exec -e`).
const count = Number(db(`SELECT COUNT(*) FROM Tasks WHERE UserId=${A.userId} AND SourceModule='shopping';`))
const sameId = ids.every((x) => x === ids[0])
console.log(`"Купити за списком" tasks in DB = ${count} (expected 1 with dedup); all clicks returned same taskId=${sameId}`)
console.log(count === 1 && sameId
  ? `REFUTED: ${N} clicks -> exactly 1 task, every click returned the same taskId (${ids[0]}). PlanTripAsync reuses the open trip.`
  : `CONFIRMED: ${N} clicks -> ${count} tasks (sameId=${sameId}); duplicates created.`)
