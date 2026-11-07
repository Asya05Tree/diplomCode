// §7 — IDOR check (expected CLOSED). A tries to READ/UPDATE/DELETE B's note.
// Update/Delete filter n.Id==id && n.UserId==CurrentUserId and return NotFound for others.
// Get filters by UserId. This PoC confirms the control holds (should print REFUTED = secure).
import { provision, api } from '../_lib/provision.mjs'

const a = await provision({ email: 'adv.t12.a@gmail.com', gender: 'female' })
const b = await provision({ email: 'adv.t12.b@gmail.com', gender: 'male' })

// B creates a secret note
const made = await api('POST', '/api/notes', { token: b.token, body: { text: 'B-secret', color: '#cdeffd' } })
const bNoteId = made.json.id
console.log(`B created note id=${bNoteId}`)

// A tries to read B's notes (own list only)
const aList = (await api('GET', '/api/notes', { token: a.token })).json
const leaked = aList.some((n) => n.id === bNoteId)
console.log(`A GET sees B's note in own list: ${leaked}`)

// A tries to UPDATE B's note
const upd = await api('PUT', `/api/notes/${bNoteId}`, { token: a.token, body: { text: 'HACKED', color: '#ff0000' } })
console.log(`A PUT /api/notes/${bNoteId} -> ${upd.status} (expect 404)`)

// A tries to DELETE B's note
const del = await api('DELETE', `/api/notes/${bNoteId}`, { token: a.token })
console.log(`A DELETE /api/notes/${bNoteId} -> ${del.status} (expect 404)`)

// Verify B's note is intact and unchanged
const bList = (await api('GET', '/api/notes', { token: b.token })).json
const still = bList.find((n) => n.id === bNoteId)
console.log(`B's note after attack: ${JSON.stringify(still)}`)

const secure = !leaked && upd.status === 404 && del.status === 404 && still?.text === 'B-secret'
console.log(secure
  ? '\nREFUTED ⚪ — IDOR correctly closed (UserId filter + 404 for cross-user id)'
  : '\nCONFIRMED 🔴 — IDOR present!')
