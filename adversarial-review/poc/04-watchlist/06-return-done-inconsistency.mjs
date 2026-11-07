// §9 — inconsistent paths into "done". /status done sets the linked reading event
// Status="Done"; /return -> done leaves the reading event ACTIVE (Planned).
import { provision, api } from '../_lib/provision.mjs'
import { db } from './_db.mjs'

const U = await provision({ email: 'adv.t04.returndone@gmail.com' })
const tok = U.token
const uid = U.userId

// Path A: /status done
const a = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'PathA-status' } })
await api('POST', `/api/media/${a.json.id}/schedule`, { token: tok, body: { startDateTime: '2030-05-01T10:00:00' } })
const [[aTask]] = db(`SELECT TaskId FROM MediaItems WHERE Id=${a.json.id};`)
await api('PUT', `/api/media/${a.json.id}/status`, { token: tok, body: { status: 'done', ratingStars: 4 } })
const aEvStatus = db(`SELECT Status FROM Tasks WHERE Id=${aTask};`)[0][0]
console.log(`Path A (/status done): reading event taskId=${aTask} Status=${aEvStatus}`)

// Path B: library book scheduled (in_progress) then returned -> done
const b = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'PathB-return', isLibrary: true, returnDeadline: '2030-07-01' } })
await api('POST', `/api/media/${b.json.id}/schedule`, { token: tok, body: { startDateTime: '2030-05-01T10:00:00' } })
const [[bTask]] = db(`SELECT TaskId FROM MediaItems WHERE Id=${b.json.id};`)
const ret = await api('PUT', `/api/media/${b.json.id}/return`, { token: tok, body: { returned: true } })
const bStatus = ret.json.status
const bEvStatus = db(`SELECT Status FROM Tasks WHERE Id=${bTask};`)[0][0]
console.log(`Path B (/return -> done): item.status=${bStatus}, reading event taskId=${bTask} Status=${bEvStatus}`)

console.log('\n==== RESULT ====')
console.log(aEvStatus === 'Done' && bStatus === 'done' && bEvStatus !== 'Done'
  ? `CONFIRMED: /status done marks event Done (${aEvStatus}); /return->done leaves reading event ${bEvStatus} (active) — inconsistent`
  : `REFUTED: aEvStatus=${aEvStatus} bStatus=${bStatus} bEvStatus=${bEvStatus}`)
