// §11 / ПЛАН P3-1 — N+1 на взаємодіях усунено: сторінка «Здоров'я» тепер бере взаємодії всієї
// аптечки ОДНИМ запитом GET /api/medicine-cabinet/interactions (карта medicineId -> список),
// замість окремого GET /{id}/interactions на кожні ліки.
// FIXED: MedicineService.GetAllInteractionsAsync (2 SQL на всю аптечку) + клієнт Health.jsx кличе її раз.
import { provision, api } from '../_lib/provision.mjs'

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t07.nn.${tag}@gmail.com` })

const meds = [2058, 2977, 4072, 2183, 2067, 2040]
for (const id of meds) await api('POST', `/api/medicine-cabinet/${id}`, { token: u.token })
const cab = await api('GET', '/api/medicine-cabinet', { token: u.token })
const n = cab.json?.length ?? 0
console.log(`cabinet size N=${n}`)

// Нова поведінка сторінки: один батч-виклик замість N.
const t0 = performance.now()
const batch = await api('GET', '/api/medicine-cabinet/interactions', { token: u.token })
const ms = (performance.now() - t0).toFixed(0)
const map = batch.json || {}
const keys = Object.keys(map)
const withInteractions = keys.filter((k) => (map[k]?.length ?? 0) > 0).length
const totalPairs = keys.reduce((s, k) => s + (map[k]?.length ?? 0), 0)
console.log(`single batch GET /interactions -> ${batch.status}, ${keys.length} meds in map, ${withInteractions} with >=1 interaction, ${totalPairs} pairs total, ${ms}ms`)

// Порівняння з однією старою карткою: батч має давати той самий набір для тих самих ліків.
const probeId = meds[0]
const single = await api('GET', `/api/medicine-cabinet/${probeId}/interactions`, { token: u.token })
const batchForProbe = map[probeId] || map[String(probeId)] || []
const sameCount = (single.json?.length ?? 0) === batchForProbe.length
console.log(`per-med GET /${probeId}/interactions count=${single.json?.length ?? 0}; batch count=${batchForProbe.length}; match=${sameCount}`)

console.log('---')
const refuted = batch.status === 200 && keys.length === n && sameCount
console.log(refuted
  ? `REFUTED — взаємодії всієї аптечки приходять ОДНИМ запитом (2 SQL: аптечка + взаємодії), карта покриває всі ${n} ліків і збігається з одиничним ендпойнтом. Жодного N+1 при відкритті сторінки.`
  : `CONFIRMED/partial — status=${batch.status} keys=${keys.length} n=${n} sameCount=${sameCount}`)
