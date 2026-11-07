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
console.log(`   ${fc.rangeDays > 30 ? 'CONFIRMED (ACCEPTED/out-of-scope: forecast width is cosmetic, NOT part of the committed P1-6 fix — see below): rangeDays has no upper cap; a dirty/short interval inflates the window' : 'rangeDays=' + fc.rangeDays}`)
console.log(`   avg cycle length reported = ${fc.averageLength} days (skewed by 1-day + 300-day intervals)`)
for (const r of (await api('GET', '/api/cycle', { token: T })).json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })

// GET side-effect: hygiene set + ongoing period -> every GET may INSERT a ShoppingItem (Source=Cycle)
const today = new Date().toISOString().slice(0, 10)
await api('PUT', '/api/cycle/settings', { token: T, body: { reduceLoadOnHeavyDays: false, hygieneProduct: 'pads' } })
await api('POST', '/api/cycle/start', { token: T, body: { date: today } }) // ongoing today
const before = Number(sql(`SELECT COUNT(*) FROM ShoppingItems WHERE UserId=${u.userId} AND Source='Cycle';`))
for (let i = 0; i < 3; i++) await api('GET', '/api/cycle', { token: T }) // repeated reads
const afterReads = Number(sql(`SELECT COUNT(*) FROM ShoppingItems WHERE UserId=${u.userId} AND Source='Cycle';`))
console.log('\n(GET IDEMPOTENCY) P1-6 — "повторний GET не змінює рядки в БД":')
console.log(`   Cycle ShoppingItems before reads=${before}, after 3x GET=${afterReads}`)
// Коректний критерій: GET мутує лише якщо КІЛЬКІСТЬ ЗРОСЛА від читань (before — вже 1 через POST /start,
// а не через GET; стара перевірка ">=1" була хибно-позитивною).
console.log(`   ${afterReads > before ? 'CONFIRMED: GET /api/cycle performs writes (read not idempotent)' : 'REFUTED: GET /api/cycle is idempotent — 3 reads inserted 0 rows (GetAsync не кличе EnsureHygieneSupply; докидання засобу — лише на POST записів/налаштувань)'}`)

// Re-add after checking off: раніше дедуп блокував лише НЕвідмічені → відмітка + GET повторно докидали.
// Тепер GET не докидає взагалі, тож відмітка + GET не створює нового рядка.
sql(`UPDATE ShoppingItems SET IsChecked=1 WHERE UserId=${u.userId} AND Source='Cycle';`)
await api('GET', '/api/cycle', { token: T })
const afterCheck = Number(sql(`SELECT COUNT(*) FROM ShoppingItems WHERE UserId=${u.userId} AND Source='Cycle';`))
console.log(`   after checking off + 1 GET: total Cycle items=${afterCheck} (${afterCheck > afterReads ? 'CONFIRMED: re-adds once checked off — no one-per-cycle binding' : 'REFUTED: checking off + GET does not re-add (GET більше не тригерить EnsureHygieneSupply)'})`)
for (const r of (await api('GET', '/api/cycle', { token: T })).json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })
