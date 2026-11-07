// §11 (🔴): N+1 on interactions. The page calls GET /{id}/interactions once PER medicine in the cabinet,
// and each call re-reads the whole cabinet with Includes + queries SubstanceInteractions.
// Here: build a cabinet of N meds, then reproduce the client's Promise.all(meds.map(getInteractions)).
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t07.nn@gmail.com' })

// Add a handful of real meds (some with known interactions) to the cabinet.
const meds = [2058, 2977, 4072, 2183, 2067, 2040]
for (const id of meds) await api('POST', `/api/medicine-cabinet/${id}`, { token: u.token })
const cab = await api('GET', '/api/medicine-cabinet', { token: u.token })
const n = cab.json?.length ?? 0
console.log(`cabinet size N=${n}`)

// Reproduce EXACT client behavior: one HTTP round-trip per medicine.
const t0 = performance.now()
let httpCalls = 0, withInteractions = 0
await Promise.all((cab.json || []).map(async (m) => {
  httpCalls++
  const r = await api('GET', `/api/medicine-cabinet/${m.medicineId}/interactions`, { token: u.token })
  if ((r.json?.length ?? 0) > 0) withInteractions++
}))
const ms = (performance.now() - t0).toFixed(0)

console.log(`page load fired ${httpCalls} separate HTTP requests (one per medicine), ${ms}ms`)
console.log(`${withInteractions}/${n} meds returned >=1 interaction`)
console.log('each GET /interactions internally runs: lookup med+substance, full UserMedicines.Where(UserId).Include(Medicine.Substance), SubstanceInteractions query => ~3 SQL. Total ~' + (httpCalls*3) + ' SQL for one page open.')

console.log('---')
console.log(`CONFIRMED: N+1 — ${httpCalls} HTTP calls + ~${httpCalls*3} SQL to render interactions for ${n} meds. The whole cabinet is re-read ${httpCalls} times (MedicineService.GetInteractionsAsync cs:220). Scales linearly with cabinet size; reloadCabinet repeats it on every add (Health.jsx:182,115). DoS/perf surface; should be one batch endpoint.`)
