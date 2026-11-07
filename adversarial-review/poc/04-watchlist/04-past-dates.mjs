// §10 (fixed, ПЛАН P2-8): server now validates dates.
// Past return deadline (Add) -> 400; setting deadline to the past (Update) -> 400;
// scheduling in the past -> 400. Guard: an already-overdue book stays EDITABLE as long as
// the (past) deadline is not changed — editing its title must still 200.
import { provision, api } from '../_lib/provision.mjs'
import { db } from './_db.mjs'

const U = await provision({ email: 'adv.t04.dates@gmail.com' })
const tok = U.token

const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const lastYear = '2000-01-01'

// Past return deadline on Add -> must be rejected
const m = await api('POST', '/api/media', {
  token: tok,
  body: { kind: 'book', title: 'PastDeadline', isLibrary: true, returnDeadline: yesterday },
})
console.log(`Add library book deadline=${yesterday}: status=${m.status} ${JSON.stringify(m.json)}`)

// Set deadline to the past on Update -> must be rejected
const m2 = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'EditToPast', isLibrary: true, returnDeadline: '2030-01-01' } })
const upd = await api('PUT', `/api/media/${m2.json.id}`, { token: tok, body: { title: 'EditToPast', isLibrary: true, returnDeadline: lastYear } })
console.log(`Update deadline to ${lastYear}: status=${upd.status} ${JSON.stringify(upd.json)}`)

// Past schedule date -> must be rejected
const v = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'PastSchedule' } })
const sch = await api('POST', `/api/media/${v.json.id}/schedule`, { token: tok, body: { startDateTime: '2001-01-01T10:00:00', durationMinutes: 60 } })
console.log(`Schedule in the past (2001): status=${sch.status} ${JSON.stringify(sch.json)}`)

// Regression guard: a book whose deadline became overdue naturally must stay editable while the
// (past) deadline is UNCHANGED. Simulate by back-dating the row, then edit the title with the same date.
const overdue = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'Overdue', isLibrary: true, returnDeadline: '2030-01-01' } })
db(`UPDATE MediaItems SET ReturnDeadline='2000-06-01 00:00:00' WHERE Id=${overdue.json.id};`)
const editKept = await api('PUT', `/api/media/${overdue.json.id}`, { token: tok, body: { title: 'Overdue (renamed)', isLibrary: true, returnDeadline: '2000-06-01' } })
console.log(`Edit title of already-overdue book, deadline unchanged: status=${editKept.status} isDebt=${editKept.json?.isDebt}`)

console.log('\n==== RESULT ====')
const addRej = m.status === 400 && m.json?.error === 'past_deadline'
const updRej = upd.status === 400 && upd.json?.error === 'past_deadline'
const schRej = sch.status === 400 && sch.json?.error === 'past_date'
const keptOk = editKept.status === 200
console.log(`Past deadline on Add:      ${addRej ? 'REFUTED (400 past_deadline)' : `CONFIRMED (${m.status})`}`)
console.log(`Set deadline to past (Upd): ${updRej ? 'REFUTED (400 past_deadline)' : `CONFIRMED (${upd.status})`}`)
console.log(`Schedule in the past:       ${schRej ? 'REFUTED (400 past_date)' : `CONFIRMED (${sch.status})`}`)
console.log(`Edit overdue book (guard):  ${keptOk ? 'OK — still editable (not over-rejected)' : `REGRESSION (${editKept.status})`}`)
console.log('\n' + (addRej && updRej && schRej && keptOk
  ? 'ALL REFUTED — server validates dates; overdue books remain editable.'
  : 'SOME NOT REFUTED — investigate.'))
