// TAB 11 §6/§10 — server has NO date-logic validation.
// (a) EndDate < StartDate accepted (negative period length)
// (b) AddDays overflow near DateOnly.MaxValue -> 500 on GET
// (c) overlapping / nested periods accepted (start inside existing period)
// (d) POST /records allows duplicate starts on same date (no dedup)
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t11.dates@gmail.com', nickname: 'Dates', gender: 'female' })
const T = u.token
console.log('user', u.userId)

// wipe any prior records for a clean slate
const pre = await api('GET', '/api/cycle', { token: T })
for (const r of pre.json?.records ?? []) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })

// (a) end before start
const s1 = await api('POST', '/api/cycle/records', { token: T, body: { startDate: '2026-05-10' } })
const id1 = s1.json.id
const bad = await api('POST', `/api/cycle/records/${id1}/end`, { token: T, body: { endDate: '2026-05-01' } })
const after = await api('GET', '/api/cycle', { token: T })
const rec = after.json.records.find((r) => r.id === id1)
console.log('\n(a) end<start:')
console.log(`   POST end -> HTTP ${bad.status}; stored record = ${JSON.stringify(rec)}`)
const negAccepted = bad.status === 200 && rec && rec.endDate < rec.startDate
console.log(`   ${negAccepted ? 'CONFIRMED: end<start accepted (negative period length)' : 'not reproduced'}`)

// cleanup
for (const r of after.json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })

// (b) overflow near DateOnly.MaxValue -> GET 500
await api('POST', '/api/cycle/records', { token: T, body: { startDate: '9999-12-20' } })
const ov = await api('GET', '/api/cycle', { token: T })
console.log('\n(b) AddDays overflow (single record 9999-12-20, forecast = +28d):')
console.log(`   GET /api/cycle -> HTTP ${ov.status}  body=${ov.text?.slice(0, 160)}`)
const overflow500 = ov.status >= 500
console.log(`   ${overflow500 ? 'CONFIRMED: ArgumentOutOfRangeException -> 500, GET /api/cycle is DoS-able' : 'not reproduced (status ' + ov.status + ')'}`)
// cleanup overflow record (GET failed, so fetch ids directly impossible; delete via list once we remove the record)
// The record blocks every future GET, so remove it to restore the account.
{
  // We cannot read records (GET 500). Delete by brute id range is not scoped-safe; instead
  // post a second nearby record so forecast uses avg of two (still may overflow). Safer: clear by date.
  const cl = await api('POST', '/api/cycle/clear', { token: T, body: { date: '9999-12-20' } })
  console.log(`   cleanup clear 9999-12-20 -> HTTP ${cl.status}; GET now -> HTTP ${(await api('GET', '/api/cycle', { token: T })).status}`)
}

// (c) overlapping / nested periods
await api('POST', '/api/cycle/start', { token: T, body: { date: '2026-01-01' } })
await api('POST', '/api/cycle/end', { token: T, body: { date: '2026-01-08' } }) // closes 01-01..01-08
const inside = await api('POST', '/api/cycle/start', { token: T, body: { date: '2026-01-05' } }) // start INSIDE
const ovr = await api('GET', '/api/cycle', { token: T })
console.log('\n(c) overlapping periods (start 05 inside 01..08):')
console.log(`   POST start-inside -> HTTP ${inside.status}; records = ${JSON.stringify(ovr.json.records)}`)
const hasOverlap = ovr.json.records.some((r) => r.startDate === '2026-01-05') && ovr.json.records.some((r) => r.startDate === '2026-01-01')
console.log(`   ${hasOverlap ? 'CONFIRMED: nested/overlapping periods accepted (no overlap check)' : 'not reproduced'}`)
for (const r of ovr.json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })

// (d) duplicate starts via POST /records (unlike /start which dedups)
const d1 = await api('POST', '/api/cycle/records', { token: T, body: { startDate: '2026-06-01' } })
const d2 = await api('POST', '/api/cycle/records', { token: T, body: { startDate: '2026-06-01' } })
const dup = await api('GET', '/api/cycle', { token: T })
const sameDate = dup.json.records.filter((r) => r.startDate === '2026-06-01')
console.log('\n(d) duplicate records on same date via POST /records:')
console.log(`   ids ${d1.json.id}, ${d2.json.id}; records@2026-06-01 = ${sameDate.length}`)
console.log(`   ${sameDate.length >= 2 ? 'CONFIRMED: duplicate starts accepted (POST /records has no dedup)' : 'not reproduced'}`)
for (const r of dup.json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })
