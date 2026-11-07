// ПЛАН P3-3 — тижневе меню «Їжі» тепер зберігається НА СЕРВЕРІ (було лише в localStorage браузера,
// губилося при зміні пристрою). Перевіряємо: GET/PUT round-trip, фільтрацію неіснуючих рецептів,
// межі днів, і що збережене видно «з іншого пристрою» (інший токен того самого акаунта).
import { provision, api } from '../_lib/provision.mjs'

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t06.menu.${tag}@gmail.com` })

// Беремо кілька справжніх recipeId з overview.
const ov = await api('GET', '/api/food/overview', { token: u.token })
const recipeIds = (ov.json?.recipes || []).map((r) => r.id).slice(0, 3)
console.log('recipeIds for test =', JSON.stringify(recipeIds))

// 1) Початково меню порожнє (усі 7 днів).
const empty = await api('GET', '/api/food/menu', { token: u.token })
const allEmpty = [1,2,3,4,5,6,7].every((d) => Array.isArray(empty.json?.[d]) && empty.json[d].length === 0)
console.log('initial GET /menu ->', empty.status, 'allEmpty=', allEmpty)

// 2) PUT меню: день 1 — два рецепти (з повтором), день 3 — один; + сміття (неіснуючий id, день 9).
const put = await api('PUT', '/api/food/menu', { token: u.token, body: { menu: {
  1: [recipeIds[0], recipeIds[1], recipeIds[0]],
  3: [recipeIds[2]],
  9: [recipeIds[0]],           // поза 1..7 — має бути відкинуто
  2: [99999999],               // неіснуючий рецепт — має бути відфільтровано
} } })
console.log('PUT /menu ->', put.status)

// 3) GET назад: збереглося рівно те, що валідне.
const back = await api('GET', '/api/food/menu', { token: u.token })
const day1 = back.json?.[1] || []
const day2 = back.json?.[2] || []
const day3 = back.json?.[3] || []
console.log('after PUT: day1=', JSON.stringify(day1), 'day2=', JSON.stringify(day2), 'day3=', JSON.stringify(day3))

// 4) «Інший пристрій»: повторний вхід у той самий акаунт (новий токен, той самий userId) бачить меню.
const u2 = await provision({ email: `adv.t06.menu.${tag}@gmail.com` })
const other = await api('GET', '/api/food/menu', { token: u2.token })
const sameOnOtherDevice = u2.userId === u.userId && JSON.stringify(other.json?.[1] || []) === JSON.stringify(day1)
console.log('other-device (re-login) userId match=', u2.userId === u.userId, 'day1=', JSON.stringify(other.json?.[1] || []), 'same=', sameOnOtherDevice)

const refuted =
  empty.status === 200 && allEmpty &&
  put.status === 200 &&
  JSON.stringify(day1) === JSON.stringify([recipeIds[0], recipeIds[1], recipeIds[0]]) &&
  day2.length === 0 &&                                   // неіснуючий відфільтровано
  JSON.stringify(day3) === JSON.stringify([recipeIds[2]]) &&
  !(back.json?.[9]) &&                                   // день поза межами не збережено
  sameOnOtherDevice

console.log('\n' + (refuted
  ? 'REFUTED — меню зберігається на сервері: round-trip точний (порядок і повтори збережено), неіснуючі ' +
    'рецепти й дні поза 1..7 відкинуто, і воно видно з іншого пристрою (інший токен). localStorage більше не єдине джерело.'
  : 'CONFIRMED/partial — empty=' + allEmpty + ' put=' + put.status + ' day1=' + JSON.stringify(day1) +
    ' day2=' + JSON.stringify(day2) + ' day3=' + JSON.stringify(day3) + ' other=' + sameOnOtherDevice))
