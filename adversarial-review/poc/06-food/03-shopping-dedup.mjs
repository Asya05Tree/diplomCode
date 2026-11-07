// §9 (fixed, ПЛАН P2-9) — Shopping-list dedup + §8 productId validation.
// AddItemAsync now dedups: an unchecked item with the same (user, productId) is not duplicated —
// repeated OutOfStock toggles leave exactly ONE Groceries row. A non-existent/foreign productId is
// rejected with 400 invalid_product (P2-2 guard), not a raw 500 FK violation.
// Was: 5 toggles -> 5 identical rows; bogus productId -> 500.
//
// Run: node 03-shopping-dedup.mjs
import { provision, api } from '../_lib/provision.mjs'

// Унікальний email на кожен прогін: provision при email_taken лише логіниться (не чистить дані), тож
// фіксований email накопичував би позиції з попередніх сесій і маскував справжню поведінку дедупу.
const tag = Math.random().toString(36).slice(2, 7)
const U = await provision({ email: `adv.t06.shop.${tag}@gmail.com` })

// pick a real system product to toggle
const ov0 = await api('GET', '/api/food/overview', { token: U.token })
const pid = ov0.json.products[0].id
console.log(`Using product id=${pid} ("${ov0.json.products[0].nameUk}")`)

function countGroceries(list) {
  return (list.items || []).filter((i) => i.productId === pid && i.section === 'Groceries').length
}

// Simulate the client OutOfStock path 5 times (toggle to OutOfStock repeatedly).
for (let i = 0; i < 5; i++) {
  await api('PUT', `/api/food/stock/${pid}`, { token: U.token, body: { state: 'OutOfStock' } })
  await api('POST', '/api/shopping-list', { token: U.token, body: { section: 'Groceries', productId: pid } })
}
let list = (await api('GET', '/api/shopping-list', { token: U.token })).json
console.log(`After 5x OutOfStock: ${countGroceries(list)} identical "Groceries" rows for pid=${pid} (expected 1)`)

// §8 🟡 add a NON-EXISTENT productId to shopping list — server does not validate existence.
const ghost = 99999999
const addGhost = await api('POST', '/api/shopping-list', { token: U.token, body: { section: 'Groceries', productId: ghost } })
list = (await api('GET', '/api/shopping-list', { token: U.token })).json
const ghostRow = (list.items || []).find((i) => i.productId === ghost)
console.log(`Add bogus productId=${ghost}: HTTP ${addGhost.status}, row present=${!!ghostRow} name="${ghostRow?.displayNameUk}"`)

const dupCount = countGroceries((await api('GET', '/api/shopping-list', { token: U.token })).json)
console.log('\n' + (dupCount === 1
  ? `REFUTED (dedup): exactly 1 Groceries row for pid=${pid} after 5 OutOfStock toggles. AddItemAsync dedups by (user, product, unchecked).`
  : `CONFIRMED (dedup): ${dupCount} rows after 5 toggles (expected 1).`))
console.log(addGhost.status === 400 && !ghostRow
  ? `REFUTED (productId validation): bogus productId ${ghost} -> HTTP 400 invalid_product, no row inserted (graceful, not a 500 FK crash).`
  : `CONFIRMED (productId validation): bogus productId ${ghost} -> HTTP ${addGhost.status}, row present=${!!ghostRow}.`)
