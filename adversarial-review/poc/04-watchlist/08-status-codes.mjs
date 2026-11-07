// §6/§7 — status codes, auth, error contracts.
import { provision, api } from '../_lib/provision.mjs'

const U = await provision({ email: 'adv.t04.codes@gmail.com' })
const tok = U.token
const line = (l, got, exp) => console.log(`${got === exp ? 'OK ' : 'XX '} ${l}: got=${got} expected=${exp}`)

// auth: no token -> 401
const noauth = await api('GET', '/api/media', {})
line('GET /api/media without JWT', noauth.status, 401)

// create base item
const m = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'codes' } })
const id = m.json.id

// SetStatus: invalid status
let r = await api('PUT', `/api/media/${id}/status`, { token: tok, body: { status: 'zzz' } })
line('status invalid_status', `${r.status}/${r.json?.error}`, '400/invalid_status')
// SetStatus: in_progress -> use_schedule
r = await api('PUT', `/api/media/${id}/status`, { token: tok, body: { status: 'in_progress' } })
line('status in_progress -> use_schedule', `${r.status}/${r.json?.error}`, '400/use_schedule')
// SetStatus: done ok (from planned, forward)
r = await api('PUT', `/api/media/${id}/status`, { token: tok, body: { status: 'done' } })
line('status planned->done', r.status, 200)
// SetStatus: backward done->planned
r = await api('PUT', `/api/media/${id}/status`, { token: tok, body: { status: 'planned' } })
line('status done->planned backward', `${r.status}/${r.json?.error}`, '400/backward_not_allowed')
// Schedule on done item -> already_scheduled (Status!=planned)
r = await api('POST', `/api/media/${id}/schedule`, { token: tok, body: { startDateTime: '2030-01-01T10:00:00' } })
line('schedule non-planned', `${r.status}/${r.json?.error}`, '400/already_scheduled')
// Schedule twice guard (already_scheduled) on a fresh scheduled item
const m2 = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'sch2' } })
await api('POST', `/api/media/${m2.json.id}/schedule`, { token: tok, body: { startDateTime: '2030-01-01T10:00:00' } })
r = await api('POST', `/api/media/${m2.json.id}/schedule`, { token: tok, body: { startDateTime: '2030-02-01T10:00:00' } })
line('schedule twice', `${r.status}/${r.json?.error}`, '400/already_scheduled')

// Update missing title
r = await api('PUT', `/api/media/${id}`, { token: tok, body: { title: '  ' } })
line('update missing_title', `${r.status}/${r.json?.error}`, '400/missing_title')
// Update 404
r = await api('PUT', `/api/media/99999999`, { token: tok, body: { title: 'x' } })
line('update nonexistent', r.status, 404)

// SetReturned on non-library -> not_library
r = await api('PUT', `/api/media/${id}/return`, { token: tok, body: { returned: true } })
line('return non-library', `${r.status}/${r.json?.error}`, '400/not_library')
// SetReturned 404
r = await api('PUT', `/api/media/99999999/return`, { token: tok, body: { returned: true } })
line('return nonexistent', r.status, 404)

// Delete 404 + success contract
r = await api('DELETE', `/api/media/99999999`, { token: tok })
line('delete nonexistent', r.status, 404)
r = await api('DELETE', `/api/media/${id}`, { token: tok })
line('delete ok status', r.status, 200)
console.log(`   delete success body = ${JSON.stringify(r.json)} (text=${JSON.stringify(r.text)})`)

// idempotent return: set returned twice on a library book (second returns 200 unchanged)
const lib = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'libidem', isLibrary: true } })
await api('POST', `/api/media/${lib.json.id}/schedule`, { token: tok, body: { startDateTime: '2030-01-01T10:00:00' } })
const r1 = await api('PUT', `/api/media/${lib.json.id}/return`, { token: tok, body: { returned: true } })
const r2 = await api('PUT', `/api/media/${lib.json.id}/return`, { token: tok, body: { returned: true } })
line('return idempotent 2nd call', r2.status, 200)
console.log(`   1st returned status=${r1.json?.status} isReturned=${r1.json?.isReturned}; 2nd isReturned=${r2.json?.isReturned}`)
