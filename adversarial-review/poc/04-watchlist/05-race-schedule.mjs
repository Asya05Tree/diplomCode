// §11 — race on /schedule: no transaction/lock. Two parallel schedules on one
// planned item can both pass the Status=="planned" check, create TWO calendar
// events; item.TaskId is overwritten by the 2nd -> first event orphans.
import { provision, api } from '../_lib/provision.mjs'
import { db } from './_db.mjs'

const U = await provision({ email: 'adv.t04.race@gmail.com' })
const tok = U.token
const uid = U.userId

const m = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'RaceSchedule' } })
const id = m.json.id

// fire N parallel schedule requests
const N = 6
const reqs = Array.from({ length: N }, (_, i) =>
  api('POST', `/api/media/${id}/schedule`, { token: tok, body: { startDateTime: `2030-0${(i % 9) + 1}-01T10:00:00`, durationMinutes: 60 } }))
const res = await Promise.all(reqs)
const codes = res.map((r) => r.status)
const ok = codes.filter((c) => c === 200).length
console.log(`Parallel /schedule x${N}: statuses=${JSON.stringify(codes)} (200s=${ok})`)

const events = db(`SELECT Id, StartDateTime FROM Tasks WHERE UserId=${uid} AND SourceModule='media' AND SourceEntityId=${id};`)
const [[currentTaskId]] = db(`SELECT TaskId FROM MediaItems WHERE Id=${id};`)
const orphaned = events.filter((e) => e[0] !== String(currentTaskId))
console.log(`Calendar reading-events created for this item: ${events.length} -> ${JSON.stringify(events)}`)
console.log(`item.TaskId now = ${currentTaskId}`)
console.log(`Orphaned events (not referenced by item.TaskId): ${orphaned.length} -> ${JSON.stringify(orphaned)}`)

console.log('\n==== RESULT ====')
console.log(events.length > 1
  ? `CONFIRMED: ${events.length} reading events from one item; ${orphaned.length} orphaned (TOCTOU, no lock/transaction)`
  : 'REFUTED: only one event created (race did not win this run — retry)')
