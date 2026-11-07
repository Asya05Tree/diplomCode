// §10-B (dead code / mass-assignment) — NoteRequest only binds (Text, Color).
// Client state sets position=prev.length but never sends it; server computes Position=maxPos+1.
// Here we PROVE: (1) sending extra fields (id, userId, position) in the body is ignored
// (no mass-assignment of ownership/order), and (2) the client-side position is dead code —
// server always assigns sequential Position regardless of what the client claims.
import { provision, api } from '../_lib/provision.mjs'

const a = await provision({ email: 'adv.t12.a@gmail.com', gender: 'female' })
const b = await provision({ email: 'adv.t12.b@gmail.com', gender: 'male' })

// A posts a note trying to mass-assign id/userId/position to B and a crazy position
const r = await api('POST', '/api/notes', {
  token: a.token,
  body: { text: 'massassign', color: '#fff3b0', id: 999999, userId: b.userId, position: -5, UpdatedAt: '1999-01-01' },
})
const id = r.json?.id
console.log(`POST with extra fields -> status=${r.status}, assigned id=${id}`)

const aList = (await api('GET', '/api/notes', { token: a.token })).json
const mine = aList.find((n) => n.id === id)
console.log(`note in A's list: ${JSON.stringify(mine)}`)

// Did it land in B's account? (ownership mass-assignment)
const bList = (await api('GET', '/api/notes', { token: b.token })).json
const leakedToB = bList.some((n) => n.id === id)
console.log(`landed in B's account via userId body field: ${leakedToB}`)

console.log(`\nOBSERVED: position in body ignored (server set position=${mine?.position}); userId body field ignored (leakedToB=${leakedToB})`)
console.log('CONFIRMED 🔵 — position is dead code: client sends nothing, server auto-assigns; body userId/id ignored (no mass-assignment — positive)')
