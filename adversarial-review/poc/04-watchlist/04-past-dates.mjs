// §10 — server does NOT validate dates. Past return deadline => instant debt.
// Past schedule date => event created in the past. UI min= is the only guard.
import { provision, api } from '../_lib/provision.mjs'

const U = await provision({ email: 'adv.t04.dates@gmail.com' })
const tok = U.token

const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const lastYear = '2000-01-01'

// Past return deadline on Add -> immediate debt
const m = await api('POST', '/api/media', {
  token: tok,
  body: { kind: 'book', title: 'PastDeadline', isLibrary: true, returnDeadline: yesterday },
})
console.log(`Add library book deadline=${yesterday}: status=${m.status} isDebt=${m.json.isDebt} returnDeadline=${m.json.returnDeadline}`)

// Past return deadline on Update
const m2 = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'EditToPast', isLibrary: true, returnDeadline: '2030-01-01' } })
const upd = await api('PUT', `/api/media/${m2.json.id}`, { token: tok, body: { title: 'EditToPast', isLibrary: true, returnDeadline: lastYear } })
console.log(`Update deadline to ${lastYear}: status=${upd.status} isDebt=${upd.json.isDebt}`)

// Past schedule date
const v = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'PastSchedule' } })
const sch = await api('POST', `/api/media/${v.json.id}/schedule`, { token: tok, body: { startDateTime: '2001-01-01T10:00:00', durationMinutes: 60 } })
console.log(`Schedule in the past (2001): status=${sch.status} startDate=${sch.json.startDate} itemStatus=${sch.json.status}`)

console.log('\n==== RESULT ====')
console.log(`Past return deadline accepted (Add): ${m.status === 200 && m.json.isDebt ? 'CONFIRMED — instant debt, no server validation' : 'REFUTED'}`)
console.log(`Past return deadline accepted (Update): ${upd.status === 200 && upd.json.isDebt ? 'CONFIRMED' : 'REFUTED'}`)
console.log(`Past schedule date accepted: ${sch.status === 200 ? 'CONFIRMED — event created in the past' : 'REFUTED'}`)
