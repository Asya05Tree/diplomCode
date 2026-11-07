// TAB 11 §9/§11 — forecast rangeDays blow-up from dirty history; GET has DB side-effects.
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

const sql = (q) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', q], { encoding: 'utf8' }).trim()

const u = await provision({ email: 'adv.t11.fc@gmail.com', nickname: 'Forecast', gender: 'female' })
const T = u.token
for (const r of (await api('GET', '/api/cycle', { token: T })).json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })

// Dirty history: one 1-day interval + one 300-day interval -> spread=299 -> rangeDays explodes
await api('POST', '/api/cycle/records', { token: T, body: { startDate: '2026-01-01' } })
await api('POST', '/api/cycle/records', { token: T, body: { startDate: '2026-01-02' } }) // 1-day cycle
await api('POST', '/api/cycle/records', { token: T, body: { startDate: '2026-10-29' } }) // 300-day cycle
const fc = (await api('GET', '/api/cycle', { token: T })).json.forecast
console.log('(FORECAST blow-up) spread-driven rangeDays:')
console.log(`   forecast = ${JSON.stringify(fc)}`)
console.log(`   predicted window = +/- ${fc.rangeDays} days  -> ~${fc.rangeDays * 2}-day-wide "next start" range`)
console.log(`   ${fc.rangeDays > 30 ? 'CONFIRMED: rangeDays has no upper cap; a dirty/short interval inflates the window to absurd width' : 'rangeDays=' + fc.rangeDays}`)
console.log(`   avg cycle length reported = ${fc.averageLength} days (skewed by 1-day + 300-day intervals)`)
for (const r of (await api('GET', '/api/cycle', { token: T })).json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })

// GET side-effect: hygiene set + ongoing period -> every GET may INSERT a ShoppingItem (Source=Cycle)
const today = new Date().toISOString().slice(0, 10)
await api('PUT', '/api/cycle/settings', { token: T, body: { reduceLoadOnHeavyDays: false, hygieneProduct: 'pads' } })
await api('POST', '/api/cycle/start', { token: T, body: { date: today } }) // ongoing today
const before = sql(`SELECT COUNT(*) FROM ShoppingItems WHERE UserId=${u.userId} AND Source='Cycle';`)
for (let i = 0; i < 3; i++) await api('GET', '/api/cycle', { token: T }) // repeated reads
const afterReads = sql(`SELECT COUNT(*) FROM ShoppingItems WHERE UserId=${u.userId} AND Source='Cycle';`)
console.log('\n(GET SIDE-EFFECT) non-idempotent read:')
console.log(`   Cycle ShoppingItems before=${before}, after 3x GET=${afterReads}`)
console.log(`   ${Number(afterReads) >= 1 ? 'CONFIRMED: GET /api/cycle performs writes (EnsureHygieneSupply inserts a shopping item) — read is not idempotent' : 'no insert observed'}`)

// Re-add after checking off: dedup only blocks UNCHECKED items -> checking off re-adds on next GET
sql(`UPDATE ShoppingItems SET IsChecked=1 WHERE UserId=${u.userId} AND Source='Cycle';`)
await api('GET', '/api/cycle', { token: T })
const afterCheck = sql(`SELECT COUNT(*) FROM ShoppingItems WHERE UserId=${u.userId} AND Source='Cycle';`)
console.log(`   after checking off + 1 GET: total Cycle items=${afterCheck} (${Number(afterCheck) > Number(afterReads) ? 'CONFIRMED: re-adds once checked off — no one-per-cycle binding' : 'no re-add'})`)
for (const r of (await api('GET', '/api/cycle', { token: T })).json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })
