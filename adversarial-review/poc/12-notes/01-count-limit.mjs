// §6-B / §9-H / §10-H — Server does NOT enforce the 30-note limit.
// The MAX_NOTES=30 gate lives only in Notes.jsx handleAdd; the Add controller
// never counts existing notes. Direct POST /api/notes creates unlimited notes.
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t12.a@gmail.com', gender: 'female' })

// How many notes does A already have?
let before = (await api('GET', '/api/notes', { token: u.token })).json
console.log(`A starts with ${before.length} notes`)

const TARGET = 40 // well beyond the UI cap of 30
for (let i = before.length; i < TARGET; i++) {
  const r = await api('POST', '/api/notes', { token: u.token, body: { text: `bulk ${i}`, color: '#fff3b0' } })
  if (r.status !== 200) { console.log(`POST #${i} failed: ${r.status} ${r.text}`); break }
}

const after = (await api('GET', '/api/notes', { token: u.token })).json
console.log(`A now has ${after.length} notes (UI cap MAX_NOTES=30)`)

const expected = 'server rejects POST once user has >= 30 notes (400/409)'
const observed = `server accepted every POST; count = ${after.length} (> 30)`
const confirmed = after.length > 30
console.log(`\nEXPECTED: ${expected}`)
console.log(`OBSERVED: ${observed}`)
console.log(confirmed ? 'CONFIRMED 🔴 — no server-side note-count limit' : 'REFUTED')
