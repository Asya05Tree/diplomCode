// §6 🟡 / §8 🟡 status-code & validation behaviour, and §6 ⚪ missing-sub token crash.
// SetStockStateRequest.State white-listed (RecipeService.cs:123) -> false -> BadRequest(invalid_stock).
// SetStock returns the SAME BadRequest for bad-state AND non-existent product (client can't tell).
// AddStockByName empty/whitespace -> BadRequest(empty_name).
// CurrentUserId = int.Parse(sub!) (FoodController.cs:25) -> token without sub crashes.
//
// Run: node 05-validation-and-jwt.mjs
import { provision, api, mintToken } from '../_lib/provision.mjs'
import crypto from 'node:crypto'

const U = await provision({ email: 'adv.t06.valid@gmail.com' })
const ov = (await api('GET', '/api/food/overview', { token: U.token })).json
const realPid = ov.products[0].id

// 1) invalid state
const bad = await api('PUT', `/api/food/stock/${realPid}`, { token: U.token, body: { state: 'HACKED' } })
console.log(`invalid state -> HTTP ${bad.status} body=${bad.text}`)

// 2) non-existent product, VALID state -> same BadRequest(invalid_stock)? (ambiguous)
const ghost = await api('PUT', `/api/food/stock/88888888`, { token: U.token, body: { state: 'Available' } })
console.log(`valid state on ghost product -> HTTP ${ghost.status} body=${ghost.text}`)
console.log(`   ambiguous (same response for bad-state vs bad-product)? ${bad.text === ghost.text}`)

// 3) empty / whitespace name
const empty = await api('POST', '/api/food/stock-by-name', { token: U.token, body: { name: '   ' } })
console.log(`whitespace name -> HTTP ${empty.status} body=${empty.text}`)

// 4) null State (mass-assignment / missing field)
const nullState = await api('PUT', `/api/food/stock/${realPid}`, { token: U.token, body: {} })
console.log(`missing State field -> HTTP ${nullState.status} body=${nullState.text}`)

// 5) forged token WITHOUT sub claim -> int.Parse(null) should blow up (500) not 401
function mintNoSub() {
  const KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION'
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const payload = b64({ email: 'x@gmail.com', iss: 'planner-api', aud: 'planner-client', exp: now + 3600, iat: now })
  const sig = crypto.createHmac('sha256', KEY).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}
const noSub = await api('GET', '/api/food/overview', { token: mintNoSub() })
console.log(`token without 'sub' claim -> HTTP ${noSub.status} (500 = unhandled int.Parse(null); 401 = handled)`)

console.log('\nSummary:')
console.log(`  invalid_stock ambiguity: ${bad.status === 400 && ghost.status === 400 && bad.text === ghost.text ? 'CONFIRMED' : 'refuted'}`)
console.log(`  empty_name guard: ${empty.status === 400 ? 'works (whitespace rejected)' : 'FAILED'}`)
console.log(`  missing-sub token: ${noSub.status >= 500 ? 'CONFIRMED crash' : 'handled ('+noSub.status+')'}`)
