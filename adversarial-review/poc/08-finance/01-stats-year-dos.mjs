// §6 / summary#6 — GET /api/finance/stats?year=<out-of-range> → unhandled 500.
// GetStatsAsync clamps month but NOT year; new DateTime(year,1,1) throws
// ArgumentOutOfRangeException for year<1 or year>9999 -> 500.
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t08.a@gmail.com', gender: 'female' })

const cases = [
  { year: 0, month: 1 },
  { year: -1, month: 1 },
  { year: 10000, month: 1 },
  { year: 99999, month: 1 },
  { year: 2026, month: 1 }, // control: should be 200
]

let confirmed = false
for (const c of cases) {
  const r = await api('GET', `/api/finance/stats?year=${c.year}&month=${c.month}`, { token: u.token })
  const is500 = r.status >= 500
  console.log(`year=${c.year} month=${c.month} -> HTTP ${r.status}${is500 ? '  <-- SERVER ERROR' : ''}`)
  if (c.year < 1 || c.year > 9999) {
    if (is500) confirmed = true
  }
}

console.log('')
console.log('Expected: out-of-range year rejected with 400 (validated/clamped).')
console.log('Observed: out-of-range year -> 500 Internal Server Error (unhandled exception).')
console.log(confirmed ? 'CONFIRMED: stats year DoS (unhandled 500).' : 'REFUTED: year handled safely.')
