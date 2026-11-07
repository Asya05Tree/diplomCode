// TAB 11 §7/§6/§1 — cross-user IDOR scoping + "end with no open record" + overwrite closed record.
import { provision, mintToken, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t11.a@gmail.com', nickname: 'AdvAlpha', gender: 'female' })
const B = await provision({ email: 'adv.t11.b@gmail.com', nickname: 'AdvBeta', gender: 'female' })
console.log('A', A.userId, 'B', B.userId)

// B creates a record
for (const r of (await api('GET', '/api/cycle', { token: B.token })).json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: B.token })
const bRec = await api('POST', '/api/cycle/records', { token: B.token, body: { startDate: '2026-07-01' } })
const bId = bRec.json.id
console.log('\nB record id =', bId)

// A tries to end B's record by id
const aEndB = await api('POST', `/api/cycle/records/${bId}/end`, { token: A.token, body: { endDate: '2026-07-05' } })
console.log(`(IDOR 1) A POST /records/${bId}/end -> HTTP ${aEndB.status} (expect 404)`)
// A tries to delete B's record by id
const aDelB = await api('DELETE', `/api/cycle/records/${bId}`, { token: A.token })
console.log(`(IDOR 2) A DELETE /records/${bId} -> HTTP ${aDelB.status} (expect 404)`)
// verify B's record untouched
const bAfter = (await api('GET', '/api/cycle', { token: B.token })).json.records.find((r) => r.id === bId)
console.log('   B record after A attempts =', JSON.stringify(bAfter))
const idorSafe = aEndB.status === 404 && aDelB.status === 404 && bAfter && bAfter.endDate === null
console.log(`   ${idorSafe ? 'REFUTED: cross-user IDOR is scoped (404, data intact)' : 'CONFIRMED: IDOR!'}`)

// Forged HS256 token for an ARBITRARY userId acts as that user (auth bypass primitive)
const forged = mintToken(B.userId, 'forged@gmail.com')
const forgedGet = await api('GET', '/api/cycle', { token: forged })
console.log(`\n(FORGE) forged token for userId=${B.userId} -> GET HTTP ${forgedGet.status}; sees B records = ${JSON.stringify(forgedGet.json?.records?.map((r) => r.id))}`)
console.log(`   ${forgedGet.status === 200 ? 'CONFIRMED: committed JWT key forges any user session (reads B as B)' : 'refuted'}`)

// §6/§1 — "end" with no OPEN record overwrites an already-CLOSED record
for (const r of (await api('GET', '/api/cycle', { token: A.token })).json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: A.token })
await api('POST', '/api/cycle/start', { token: A.token, body: { date: '2026-08-01' } })
await api('POST', '/api/cycle/end', { token: A.token, body: { date: '2026-08-06' } }) // CLOSED 01..06
const beforeOv = (await api('GET', '/api/cycle', { token: A.token })).json.records[0]
// now mark "end" again on a later date — no open record exists, but server overwrites the closed one
const reEnd = await api('POST', '/api/cycle/end', { token: A.token, body: { date: '2026-08-20' } })
const afterOv = (await api('GET', '/api/cycle', { token: A.token })).json.records[0]
console.log('\n(END-SEMANTICS) overwrite already-closed record with no open period:')
console.log(`   before = ${JSON.stringify(beforeOv)}`)
console.log(`   POST /end 2026-08-20 -> HTTP ${reEnd.status}`)
console.log(`   after  = ${JSON.stringify(afterOv)}`)
const overwrote = reEnd.status === 200 && afterOv.endDate === '2026-08-20' && beforeOv.endDate === '2026-08-06'
console.log(`   ${overwrote ? 'CONFIRMED: EndByDateAsync silently overwrites a closed record (no open-record invariant)' : 'not reproduced'}`)
for (const r of (await api('GET', '/api/cycle', { token: A.token })).json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: A.token })
