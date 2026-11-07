// §9 (positive) + §6: verify interaction lookup does NOT leak reference pairs outside the user's cabinet,
// and that probing an arbitrary medicineId never reveals data. Also contrast: interactions only appear
// when BOTH substances are in the cabinet.
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t07.scope@gmail.com' })

// Add only ONE med of an interacting pair (2058<->2977 is Major per DDInter seed).
await api('POST', '/api/medicine-cabinet/2058', { token: u.token })
let r = await api('GET', '/api/medicine-cabinet/2058/interactions', { token: u.token })
console.log(`only 2058 in cabinet: interactions=${r.json?.length} (expected 0 — partner 2977 not present)`)
const noLeak = (r.json?.length ?? 0) === 0

// Now add the partner.
await api('POST', '/api/medicine-cabinet/2977', { token: u.token })
r = await api('GET', '/api/medicine-cabinet/2058/interactions', { token: u.token })
console.log(`both 2058+2977 in cabinet: interactions=${r.json?.length} level=${r.json?.[0]?.level}`)
const pairShown = (r.json?.length ?? 0) >= 1

// Probe a medicine NOT in cabinet -> empty (no reference-data exposure).
const probe = await api('GET', '/api/medicine-cabinet/4072/interactions', { token: u.token })
console.log(`probe 4072 (not in cabinet): status=${probe.status} interactions=${probe.json?.length} (expected 0/empty)`)
const probeEmpty = (probe.json?.length ?? 0) === 0

console.log('---')
if (noLeak && pairShown && probeEmpty)
  console.log('REFUTED (leak): interactions returned ONLY when both substances are in the cabinet (MedicineService.cs:220-237). Arbitrary/not-owned medicineId yields empty — DDInter reference pairs are not enumerable through this endpoint.')
else
  console.log(`CHECK: noLeak=${noLeak} pairShown=${pairShown} probeEmpty=${probeEmpty}`)
