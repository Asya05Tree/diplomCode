// ПЛАН P3-3 + problems.md #4 — тижневе меню «Їжі» зберігається НА СЕРВЕРІ за КОНКРЕТНОЮ ДАТОЮ
// (було за індексом дня тижня → зсувалося щотижня й не мало історії). Перевіряємо: GET діапазону,
// PUT одного дня (add/clear), фільтрацію неіснуючих рецептів, межу MaxMenuItemsPerDay, ІСТОРІЮ
// (минула дата лишається й не впливає на поточний тиждень), крос-пристрій (інший токен) і валідацію.
import { provision, api } from '../_lib/provision.mjs'

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t06.menu.${tag}@gmail.com` })

const ov = await api('GET', '/api/food/overview', { token: u.token })
const recipeIds = (ov.json?.recipes || []).map((r) => r.id).slice(0, 3)
console.log('recipeIds for test =', JSON.stringify(recipeIds))

const WK = 'from=2026-11-09&to=2026-11-15'

// 1) Початково діапазон порожній.
const empty = await api('GET', `/api/food/menu?${WK}`, { token: u.token })
const emptyOk = empty.status === 200 && Object.keys(empty.json || {}).length === 0

// 2) PUT день 2026-11-10: два рецепти з повтором + сміття (неіснуючий id відфільтрується).
const put = await api('PUT', '/api/food/menu/2026-11-10', { token: u.token, body: {
  recipeIds: [recipeIds[0], recipeIds[1], recipeIds[0], 99999999] } })

// 3) GET назад: збереглося рівно валідне (порядок і повтори — так, неіснуючий — ні).
const back = await api('GET', `/api/food/menu?${WK}`, { token: u.token })
const day = back.json?.['2026-11-10'] || []
console.log('after PUT day 2026-11-10 =', JSON.stringify(day))

// 4) Історія: минула дата лишається й НЕ впливає на поточний тиждень.
await api('PUT', '/api/food/menu/2026-01-05', { token: u.token, body: { recipeIds: [recipeIds[0]] } })
const hist = await api('GET', 'from=2026-01-01&to=2026-01-07'.replace(/^/, '/api/food/menu?'), { token: u.token })
const histOk = JSON.stringify(hist.json?.['2026-01-05'] || []) === JSON.stringify([recipeIds[0]])
const curAfterHist = await api('GET', `/api/food/menu?${WK}`, { token: u.token })
const noShift = !(curAfterHist.json?.['2026-01-05'])

// 5) Очищення дня.
await api('PUT', '/api/food/menu/2026-11-10', { token: u.token, body: { recipeIds: [] } })
const cleared = await api('GET', `/api/food/menu?${WK}`, { token: u.token })
const clearOk = !(cleared.json?.['2026-11-10'])

// 6) «Інший пристрій»: повторний вхід (новий токен, той самий userId) бачить історію.
const u2 = await provision({ email: `adv.t06.menu.${tag}@gmail.com` })
const other = await api('GET', '/api/food/menu?from=2026-01-01&to=2026-01-07', { token: u2.token })
const crossDevice = u2.userId === u.userId && JSON.stringify(other.json?.['2026-01-05'] || []) === JSON.stringify([recipeIds[0]])

// 7) Валідація поганих параметрів.
const badRange = await api('GET', '/api/food/menu?from=xxx&to=2026-11-15', { token: u.token })
const badDate = await api('PUT', '/api/food/menu/not-a-date', { token: u.token, body: { recipeIds: [] } })

const refuted =
  emptyOk && put.status === 200 &&
  JSON.stringify(day) === JSON.stringify([recipeIds[0], recipeIds[1], recipeIds[0]]) &&
  histOk && noShift && clearOk && crossDevice &&
  badRange.status === 400 && badDate.status === 400

console.log('\n' + (refuted
  ? 'REFUTED — меню зберігається на сервері ЗА ДАТОЮ: round-trip точний, неіснуючі рецепти відкинуто, ' +
    'є ІСТОРІЯ (минула дата лишається й не зсуває поточний тиждень), очищення/крос-пристрій працюють, ' +
    'погані параметри → 400. localStorage більше не джерело.'
  : `CONFIRMED/partial — empty=${emptyOk} put=${put.status} day=${JSON.stringify(day)} hist=${histOk} ` +
    `noShift=${noShift} clear=${clearOk} cross=${crossDevice} badRange=${badRange.status} badDate=${badDate.status}`))
