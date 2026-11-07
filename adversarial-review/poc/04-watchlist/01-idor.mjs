// §7 — IDOR / ownership scoping. User A (attacker) tries to touch user B's media item
// on every mutating endpoint using a FORGED token for A's own id but B's item id.
// Expected: every endpoint returns 404 (scoped by x.UserId == CurrentUserId), B's item unchanged.
import { provision, mintToken, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t04.attacker@gmail.com' })
const B = await provision({ email: 'adv.t04.victim@gmail.com' })

// B creates a library book with a deadline (so it owns a return reminder too)
const made = await api('POST', '/api/media', {
  token: B.token,
  body: { kind: 'book', title: 'B-secret-book', author: 'Victim', isLibrary: true, returnDeadline: '2030-01-01' },
})
const id = made.json.id
console.log(`B created media id=${id} (status ${made.status})`)

const aTok = A.token
const attacks = [
  ['GET  own-list leak', () => api('GET', '/api/media', { token: aTok })],
  ['PUT  update', () => api('PUT', `/api/media/${id}`, { token: aTok, body: { title: 'HACKED', ratingStars: 5 } })],
  ['POST schedule', () => api('POST', `/api/media/${id}/schedule`, { token: aTok, body: { startDateTime: '2030-02-02T10:00:00', durationMinutes: 60 } })],
  ['PUT  status done', () => api('PUT', `/api/media/${id}/status`, { token: aTok, body: { status: 'done', ratingStars: 1 } })],
  ['PUT  return', () => api('PUT', `/api/media/${id}/return`, { token: aTok, body: { returned: true } })],
  ['DEL  delete', () => api('DELETE', `/api/media/${id}`, { token: aTok })],
]

let anyLeak = false
for (const [name, fn] of attacks) {
  const r = await fn()
  if (name.startsWith('GET')) {
    const leaked = (r.json || []).some((m) => m.title === 'B-secret-book')
    console.log(`  ${name}: status=${r.status} leaked-B-item=${leaked}`)
    if (leaked) anyLeak = true
  } else {
    const ok404 = r.status === 404
    console.log(`  ${name}: status=${r.status} (expected 404) ${ok404 ? 'scoped-OK' : 'LEAK!'}`)
    if (!ok404) anyLeak = true
  }
}

// Verify B's item still intact & untouched
const after = await api('GET', '/api/media', { token: B.token })
const item = (after.json || []).find((m) => m.id === id)
const intact = item && item.title === 'B-secret-book' && item.status === 'planned' && !item.ratingStars
console.log(`B item after attacks: title=${item?.title} status=${item?.status} rating=${item?.ratingStars} intact=${intact}`)

// Mass-assignment of ownership: can A inject userId via Add body to plant into B?
const inj = await api('POST', '/api/media', { token: aTok, body: { kind: 'book', title: 'inject', userId: B.userId, UserId: B.userId } })
const bList = await api('GET', '/api/media', { token: B.token })
const planted = (bList.json || []).some((m) => m.title === 'inject')
console.log(`Mass-assign userId in Add: plantedIntoB=${planted} (expected false)`)

console.log('\n==== RESULT ====')
console.log(`IDOR cross-user access: ${anyLeak ? 'CONFIRMED (BROKEN)' : 'REFUTED — all 404/scoped'}`)
console.log(`Ownership mass-assignment: ${planted ? 'CONFIRMED (BROKEN)' : 'REFUTED — userId ignored'}`)
console.log(`Victim item integrity: ${intact ? 'OK' : 'VIOLATED'}`)
