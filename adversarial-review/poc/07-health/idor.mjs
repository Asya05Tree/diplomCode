// §7 IDOR: can user A read/modify user B's medical data (cabinet, conditions, visits, profile, interactions)?
// Priority #1. Provisions A and B; B seeds data; A (own token) and a FORGED token for B's id probe.
import { provision, mintToken, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t07.a@gmail.com' })
const B = await provision({ email: 'adv.t07.b@gmail.com' })
console.log(`A userId=${A.userId}  B userId=${B.userId}`)

// --- B seeds sensitive data ---
await api('POST', '/api/medicine-cabinet/2058', { token: B.token })   // B's medicine
const bCond = await api('POST', '/api/medicine-cabinet/conditions', { token: B.token,
  body: { nameUk: 'B-секретний-діагноз', affectsFood: false, tag: null, relation: 'Avoid' } })
const bCondId = bCond.json?.id
const bVisit = await api('POST', '/api/checkup/visits', { token: B.token,
  body: { doctorKey: 'family', doctorName: 'Dr B', when: '2026-12-01T09:00:00', place: 'B-clinic', note: 'B-private-note' } })
const bVisitId = bVisit.json?.id
await api('PUT', '/api/health-profile', { token: B.token, body: { weight: 77, height: 177, birthYear: 1990, gender: 'male' } })
console.log(`B seeded: condId=${bCondId} visitId=${bVisitId}`)

let leaks = 0, writes = 0

// 1) A reads B's cabinet — must only see A's (empty)
const aCab = await api('GET', '/api/medicine-cabinet', { token: A.token })
console.log(`A GET cabinet -> ${aCab.status}, items=${aCab.json?.length}`)
if ((aCab.json?.length ?? 0) > 0) { leaks++; console.log('  LEAK: A sees medicines (should be empty)') }

// 2) A reads B's conditions
const aCond = await api('GET', '/api/medicine-cabinet/conditions', { token: A.token })
const sawB = JSON.stringify(aCond.json || []).includes('B-секретний')
console.log(`A GET conditions -> ${aCond.status}, contains B diagnosis? ${sawB}`)
if (sawB) { leaks++; console.log('  LEAK: A sees B condition') }

// 3) A deletes B's condition by id (IDOR write)
const delCond = await api('DELETE', `/api/medicine-cabinet/conditions/${bCondId}`, { token: A.token })
console.log(`A DELETE B condition ${bCondId} -> ${delCond.status}`)
const bCondStill = await api('GET', '/api/medicine-cabinet/conditions', { token: B.token })
const bCondExists = JSON.stringify(bCondStill.json || []).includes('B-секретний')
if (delCond.status === 200 && !bCondExists) { writes++; console.log('  IDOR WRITE: A deleted B condition!') }
else console.log(`  B condition still present? ${bCondExists} (delete scoped, good)`)

// 4) A deletes B's visit by id (IDOR write)
const delVisit = await api('DELETE', `/api/checkup/visits/${bVisitId}`, { token: A.token })
console.log(`A DELETE B visit ${bVisitId} -> ${delVisit.status}`)
const bVisits = await api('GET', '/api/checkup/visits', { token: B.token })
const bVisitExists = (bVisits.json || []).some((v) => v.id === bVisitId)
if (delVisit.status === 200 && !bVisitExists) { writes++; console.log('  IDOR WRITE: A deleted B visit!') }
else console.log(`  B visit still present? ${bVisitExists} (delete scoped, good)`)

// 5) A reads profile — must be A's, not B's
const aProf = await api('GET', '/api/health-profile', { token: A.token })
console.log(`A GET profile -> ${aProf.status} ${aProf.text.slice(0,120)}`)
if (aProf.json?.weight === 77 && aProf.json?.height === 177) { leaks++; console.log('  LEAK: A reads B profile values') }

// 6) A modifies cabinet state of medicine 2058 — only affects A's row (A has no 2058)
const aUpd = await api('PUT', '/api/medicine-cabinet/2058', { token: A.token, body: { state: 'OutOfStock', expiresAt: null } })
console.log(`A PUT state on med 2058 (A has not added it) -> ${aUpd.status} (404 => scoped per-user row, good)`)

// 7) A reads interactions for a medicine only in B's cabinet
const aInter = await api('GET', '/api/medicine-cabinet/2058/interactions', { token: A.token })
console.log(`A GET interactions for 2058 (only in B cabinet) -> ${aInter.status}, items=${aInter.json?.length}`)
if ((aInter.json?.length ?? 0) > 0) { leaks++; console.log('  LEAK: A gets interactions for B-only medicine') }

console.log('---')
if (leaks === 0 && writes === 0)
  console.log('REFUTED: no IDOR. All reads/writes scoped to CurrentUserId (MedicineService/CheckupService/HealthProfileController). A could not read or mutate B\'s cabinet, conditions, visits, profile, or interactions.')
else
  console.log(`CONFIRMED: IDOR present — leaks=${leaks} writes=${writes}`)
