// §9 🔴 Shopping-list duplicates from stock toggling, and §8 🟡 productId not validated.
// handleStockState (Food.jsx:160-177): every OutOfStock unconditionally calls addShoppingItem,
// no inShopping check, and ShoppingService.AddItemAsync (ShoppingService.cs:122-143) always INSERTs
// a new row (no dedup) and never validates that productId exists or belongs to the user.
//
// Run: node 03-shopping-dedup.mjs
import { provision, api } from '../_lib/provision.mjs'

const U = await provision({ email: 'adv.t06.shop@gmail.com' })

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
const confirmed = dupCount >= 5
console.log('\n' + (confirmed
  ? `CONFIRMED (dedup): ${dupCount} duplicate Groceries rows after 5 OutOfStock toggles. AddItemAsync never dedups; handleStockState skips the inShopping check on the OutOfStock path. Expected: dedup by (user,product,unchecked).`
  : `NOT CONFIRMED dedup (dup=${dupCount})`))
console.log(addGhost.status === 500
  ? `SECONDARY (productId validation): bogus productId ${ghost} -> HTTP 500 (unhandled DB FK violation, no graceful 400). AddItemAsync does not pre-validate productId; data integrity saved only by the FK constraint.`
  : `productId ${ghost} -> HTTP ${addGhost.status}`)
