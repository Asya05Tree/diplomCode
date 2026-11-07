// §9 — IsDebt boundary + return branches (planned-delete, in_progress->done, done).
import { provision, api } from '../_lib/provision.mjs'
import { db } from './_db.mjs'

const U = await provision({ email: 'adv.t04.debt@gmail.com' })
const tok = U.token
const uid = U.userId
const d = (off) => new Date(Date.now() + off * 86400000).toISOString().slice(0, 10)

// Boundary: deadline == today -> NOT debt; yesterday -> debt
const today = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'DueToday', isLibrary: true, returnDeadline: d(0) } })
const yest = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'DueYesterday', isLibrary: true, returnDeadline: d(-1) } })
console.log(`deadline==today isDebt=${today.json.isDebt} (expect false); deadline==yesterday isDebt=${yest.json.isDebt} (expect true)`)

// done library overdue -> never debt
const dn = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'DoneOverdue', isLibrary: true, returnDeadline: d(-5) } })
await api('POST', `/api/media/${dn.json.id}/schedule`, { token: tok, body: { startDateTime: '2030-01-01T10:00:00' } })
const dnDone = await api('PUT', `/api/media/${dn.json.id}/status`, { token: tok, body: { status: 'done' } })
console.log(`overdue DONE library book isDebt=${dnDone.json.isDebt} (expect false — never debt, yet physically unreturned)`)

// return branch: planned & not debt -> fully deleted (+ event)
const p = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'ReturnPlanned', isLibrary: true, returnDeadline: d(10) } })
const [[pReturnTask]] = db(`SELECT ReturnTaskId FROM MediaItems WHERE Id=${p.json.id};`)
const pr = await api('PUT', `/api/media/${p.json.id}/return`, { token: tok, body: { returned: true } })
const pGone = db(`SELECT COUNT(*) FROM MediaItems WHERE Id=${p.json.id};`)[0][0] === '0'
const pReminderGone = db(`SELECT COUNT(*) FROM Tasks WHERE Id=${pReturnTask};`)[0][0] === '0'
console.log(`return(planned,not-debt): resp=${JSON.stringify(pr.json)} recordDeleted=${pGone} reminderDeleted=${pReminderGone}`)

// return branch: in_progress -> done, StatusBeforeReturn saved
const ip = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'ReturnInProg', isLibrary: true, returnDeadline: d(10) } })
await api('POST', `/api/media/${ip.json.id}/schedule`, { token: tok, body: { startDateTime: '2030-01-01T10:00:00' } })
const ipr = await api('PUT', `/api/media/${ip.json.id}/return`, { token: tok, body: { returned: true } })
const [[sbr]] = db(`SELECT StatusBeforeReturn FROM MediaItems WHERE Id=${ip.json.id};`)
console.log(`return(in_progress): status=${ipr.json.status} isReturned=${ipr.json.isReturned} StatusBeforeReturn=${sbr}`)
// reactivation
const react = await api('PUT', `/api/media/${ip.json.id}/return`, { token: tok, body: { returned: false } })
console.log(`reactivation: status=${react.json.status} isReturned=${react.json.isReturned} (expect back to in_progress)`)

console.log('\n==== RESULT ====')
console.log(`Debt boundary strict '<' : ${today.json.isDebt === false && yest.json.isDebt === true ? 'OK' : 'UNEXPECTED'}`)
console.log(`Overdue done != debt: ${dnDone.json.isDebt === false ? 'OK (by design; physically-owed book hidden from Debts)' : 'UNEXPECTED'}`)
console.log(`Planned return deletes record+reminder: ${pGone && pReminderGone ? 'OK' : 'UNEXPECTED'}`)
console.log(`Reactivation restores status: ${react.json.status === 'in_progress' ? 'OK' : 'UNEXPECTED'}`)
