// §7-M — CurrentUserId = int.Parse(User.FindFirst(Sub)!.Value) with null-forgiving '!'.
// A valid-signed JWT whose 'sub' is missing or non-numeric should ideally yield 401,
// but the '!' + int.Parse throw => 500 (NRE / FormatException), an unhandled server error.
import crypto from 'node:crypto'
import { api } from '../_lib/provision.mjs'

const KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function sign(payload) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ iss: 'planner-api', aud: 'planner-client', exp: now + 3600, iat: now, ...payload })
  const sig = crypto.createHmac('sha256', KEY).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

// 1) Validly-signed token with NO sub claim
const noSub = sign({ email: 'x@gmail.com' })
const r1 = await api('GET', '/api/notes', { token: noSub })
console.log(`no-sub token  -> ${r1.status}  ${r1.text.slice(0, 80)}`)

// 2) Validly-signed token with non-numeric sub
const badSub = sign({ sub: 'not-a-number', email: 'x@gmail.com' })
const r2 = await api('GET', '/api/notes', { token: badSub })
console.log(`bad-sub token -> ${r2.status}  ${r2.text.slice(0, 80)}`)

console.log(`\nEXPECTED: 401 Unauthorized (reject malformed identity)`)
console.log(`OBSERVED: no-sub=${r1.status}, bad-sub=${r2.status}`)
const confirmed = r1.status >= 500 || r2.status >= 500
console.log(confirmed
  ? 'CONFIRMED 🟡 — malformed-but-signed JWT causes 500 (int.Parse/! on missing sub) instead of 401'
  : 'REFUTED — framework rejected before controller (likely 401)')
