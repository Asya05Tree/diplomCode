// §11 / ПЛАН P3-2 — пошук у довіднику тепер має мінімальну довжину 2 символи НА СЕРВЕРІ (раніше
// відсікався лише порожній рядок, тож 1-символьний запит обходив клієнтський гейт і сканував ~1884
// рядки). Клієнт додатково має debounce ~300 мс. Тут перевіряємо серверний поріг.
// FIXED: MedicineService.MinQueryLength=2 у SearchAsync і SearchTagsAsync.
import { provision, api } from '../_lib/provision.mjs'

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t07.dos.${tag}@gmail.com` })

const get = async (path) => {
  const r = await api('GET', path, { token: u.token })
  return { n: Array.isArray(r.json) ? r.json.length : -1, status: r.status }
}

// 1-символьні запити → порожньо (сервер не сканує довідник)
const cyr1 = await get('/api/medicine-cabinet/search?q=%D0%B0')   // «а»
const lat1 = await get('/api/medicine-cabinet/search?q=a')
const tags1 = await get('/api/medicine-cabinet/tags?q=a')
console.log(`1-char search cyr="а"-> ${cyr1.status}/${cyr1.n}; lat="a"-> ${lat1.status}/${lat1.n}; tags="a"-> ${tags1.status}/${tags1.n} (expect 200/0)`)

// 2-символьні запити → працюють (не над-блокуємо)
const cyr2 = await get('/api/medicine-cabinet/search?q=%D0%BA%D0%BE')  // «ко»
console.log(`2-char search cyr="ко" -> ${cyr2.status}/${cyr2.n} results (expect 200, >=0 але пошук виконується)`)

console.log('---')
const refuted = cyr1.n === 0 && lat1.n === 0 && tags1.n === 0 && cyr2.status === 200
console.log(refuted
  ? 'REFUTED — 1-символьні запити повертають порожньо без сканування довідника (поріг 2 символи на сервері); 2-символьний пошук працює. Клієнт додатково debounce-ить ввід 300 мс.'
  : `CONFIRMED/partial — cyr1=${cyr1.n} lat1=${lat1.n} tags1=${tags1.n} cyr2=${cyr2.status}`)
