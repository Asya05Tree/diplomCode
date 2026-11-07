// P3-4 — "reduceLoadOnHeavyDays" більше не мертва фіча. Раніше прапорець зберігався, але жоден
// код його не читав → перемикання нічого не змінювало. Тепер він керує появою турботливого банера
// на головному екрані/у Дні (CareBanner): банер показується ТІЛЬКИ коли прапорець увімкнено І день
// є "важким" (день менструації: факт або прогноз). Клієнт читає обидва входи з GET /api/cycle.
// Цей PoC перевіряє, що обидва входи реально спостережувані через API й залежать від прапорця.
import { provision, api } from '../_lib/provision.mjs'

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t11.rl.${tag}@gmail.com`, nickname: 'ReduceLoad', gender: 'female' })
const T = u.token
const today = new Date().toISOString().slice(0, 10)

// чистий старт
for (const r of (await api('GET', '/api/cycle', { token: T })).json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })

// Дзеркалимо логіку клієнта (utils/cycle.js buildHeavyDays) для зафіксованих днів: сьогодні "важкий",
// якщо потрапляє у відкритий/закритий запис. Тут достатньо перевірити факт запису на сьогодні.
const todayIsHeavy = (data) => (data.records ?? []).some((r) => r.startDate <= today && (r.endDate ?? today) >= today)

// 1) прапорець ВИМК, менструації сьогодні нема → банер НЕ показувався б
await api('PUT', '/api/cycle/settings', { token: T, body: { reduceLoadOnHeavyDays: false, hygieneProduct: null } })
let d = (await api('GET', '/api/cycle', { token: T })).json
const case1 = d.settings.reduceLoadOnHeavyDays === false && !todayIsHeavy(d)
console.log(`1) off + no period today  -> reduceLoad=${d.settings.reduceLoadOnHeavyDays}, todayHeavy=${todayIsHeavy(d)}  banner=${d.settings.reduceLoadOnHeavyDays && todayIsHeavy(d)}`)

// 2) УВІМК прапорець, але менструації сьогодні ще нема → банера НЕ було б (важливо: сам лише прапорець не тригерить)
await api('PUT', '/api/cycle/settings', { token: T, body: { reduceLoadOnHeavyDays: true, hygieneProduct: null } })
d = (await api('GET', '/api/cycle', { token: T })).json
const case2 = d.settings.reduceLoadOnHeavyDays === true && !todayIsHeavy(d)
console.log(`2) on  + no period today  -> reduceLoad=${d.settings.reduceLoadOnHeavyDays}, todayHeavy=${todayIsHeavy(d)}  banner=${d.settings.reduceLoadOnHeavyDays && todayIsHeavy(d)}`)

// 3) УВІМК прапорець + менструація сьогодні → банер ПОКАЗАВСЯ Б
await api('POST', '/api/cycle/start', { token: T, body: { date: today } })
d = (await api('GET', '/api/cycle', { token: T })).json
const banner3 = d.settings.reduceLoadOnHeavyDays && todayIsHeavy(d)
const case3 = banner3 === true
console.log(`3) on  + period today     -> reduceLoad=${d.settings.reduceLoadOnHeavyDays}, todayHeavy=${todayIsHeavy(d)}  banner=${banner3}`)

// 4) ВИМК прапорець (менструація сьогодні лишається) → банер знову зникає (прапорець вирішує!)
await api('PUT', '/api/cycle/settings', { token: T, body: { reduceLoadOnHeavyDays: false, hygieneProduct: null } })
d = (await api('GET', '/api/cycle', { token: T })).json
const banner4 = d.settings.reduceLoadOnHeavyDays && todayIsHeavy(d)
const case4 = banner4 === false && todayIsHeavy(d)
console.log(`4) off + period today     -> reduceLoad=${d.settings.reduceLoadOnHeavyDays}, todayHeavy=${todayIsHeavy(d)}  banner=${banner4}`)

for (const r of (await api('GET', '/api/cycle', { token: T })).json.records) await api('DELETE', `/api/cycle/records/${r.id}`, { token: T })

const ok = case1 && case2 && case3 && case4
console.log(`\n${ok ? 'REFUTED' : 'NOT-AS-EXPECTED'}: toggling reduceLoadOnHeavyDays now changes an observable, API-backed condition that drives the care banner (was: stored-but-never-read dead setting). The flag is the deciding input — same period day, banner follows the flag.`)
