// P1-8 (частина про заборонені рецепти) — spec §4.6: «блюда с запретом не показываются вообще».
// Критерій плану (рядок 163): заборонений рецепт ВІДСУТНІЙ у відповіді API, а не лише прихований клієнтом.
// Раніше фільтрація була клієнтською (Food.jsx visibleRecipes) → сервер віддавав заборонені рецепти.
// Тепер GetOverviewAsync фільтрує заборонені на сервері. Цей PoC це перевіряє.
//
// Примітка: використовуємо tagged email (не фіксований) — інакше акаунт накопичує Forbidden-теги між
// прогонами, усі рецепти стають забороненими, overview порожніє, і стара версія падала на recipes[0].
//
// Run: node 04-overview-and-recipe-authz.mjs
import { provision, api } from '../_lib/provision.mjs'

const tag = Math.random().toString(36).slice(2, 7)
const U = await provision({ email: `adv.t06.fr.${tag}@gmail.com` })

const ov = (await api('GET', '/api/food/overview', { token: U.token })).json
const before = ov.recipes ?? []
console.log(`overview before restrictions: ${before.length} recipes`)
if (before.length === 0) {
  console.log('NOTE: recipe catalog empty у цьому середовищі — перевірку фільтрації провести неможливо (пропускаю).')
  process.exit(0)
}
const idsBefore = new Set(before.map((r) => r.id))

// Забороняємо поширені теги, щоб частина рецептів стала forbidden.
for (const tag of ['dairy', 'gluten', 'meat', 'egg', 'vegetable', 'sugar', 'salt']) {
  await api('PUT', '/api/health-profile/restrictions', { token: U.token, body: { tagKey: tag, relation: 'Forbidden', weight: null } })
}

const ov2 = (await api('GET', '/api/food/overview', { token: U.token })).json
const after = ov2.recipes ?? []
const idsAfter = new Set(after.map((r) => r.id))
const dropped = [...idsBefore].filter((id) => !idsAfter.has(id))       // зникли з API-стрічки
const forbiddenStillShown = after.filter((r) => r.health?.forbidden)  // прапор forbidden, але все одно у стрічці

console.log(`after Forbidden on common tags: ${after.length} recipes in feed (dropped ${dropped.length}); forbidden-flagged STILL in feed: ${forbiddenStillShown.length}`)

// REFUTED, якщо: заборонені рецепти зникли зі стрічки (dropped>0) і жодного forbidden-прапора не лишилось у відповіді.
const refuted = dropped.length > 0 && forbiddenStillShown.length === 0
console.log('\n' + (refuted
  ? `REFUTED: server omits forbidden recipes from the API feed — ${dropped.length} recipe(s) disappeared after forbidding tags, 0 forbidden recipes remain in payload. Фільтрація серверна, не клієнтська (spec §4.6).`
  : `CONFIRMED: forbidden recipes still leak via API (dropped=${dropped.length}, forbidden-in-feed=${forbiddenStillShown.length}).`))

// SECONDARY (не є критерієм P1-8): чи приймає сервер select/cook за ПРЯМИМ id забороненого рецепта.
// Омісія зі стрічки — ось committed-фікс; гард на пряму дію за id — окреме (поза обсягом) питання.
if (dropped.length) {
  const fid = dropped[0]
  const sel = await api('POST', `/api/food/selected/${fid}`, { token: U.token })
  const cook = await api('POST', `/api/food/recipes/${fid}/cooked`, { token: U.token })
  console.log(`\nSECONDARY (out-of-scope): select/cook forbidden recipe id ${fid} -> ${sel.status}/${cook.status} (committed-фікс — саме омісія зі стрічки, перевірена вище).`)
}
