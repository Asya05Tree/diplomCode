// §10 / §9 / §11 — The "≤ 1 month" period window and free-days range are enforced ONLY on the
// client. Server GET period / free-days only check from>to. GetFreeDaysAsync iterates from..to
// day-by-day with no clamp (TaskService.cs:322). Huge range → huge CPU/time.
import { provision, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })

async function timed(label, path) {
  const t0 = Date.now()
  const res = await api('GET', path, { token: A.token })
  const ms = Date.now() - t0
  const len = (res.text || '').length
  console.log(`${label}: status=${res.status} time=${ms}ms bodyBytes=${len}`)
  return { ms, status: res.status, len }
}

// ~200 years of free-days — server loops ~73000 days
const fd = await timed('free-days 1900-01-01..2100-01-01', '/api/tasks/free-days?from=1900-01-01&to=2100-01-01&minHours=2')
const pd = await timed('period    1900-01-01..2100-01-01', '/api/tasks/period?from=1900-01-01&to=2100-01-01')
// baseline: 1 month
const base = await timed('free-days 1 month (baseline)', '/api/tasks/free-days?from=2026-11-01&to=2026-11-30&minHours=2')

const confirmed = (fd.status === 200 && fd.ms > base.ms * 20) || (pd.status === 200 && pd.ms > base.ms * 20) ||
  fd.len > 500000
console.log('\n' + (confirmed
  ? `CONFIRMED — server accepts unbounded range and does O(days) work (expected: 400 range_too_large). ` +
    `free-days 200y = ${fd.ms}ms / ${fd.len} bytes vs 1-month ${base.ms}ms. No server-side range cap.`
  : `REFUTED / weak — free-days200y=${fd.ms}ms status=${fd.status}, baseline=${base.ms}ms`))
