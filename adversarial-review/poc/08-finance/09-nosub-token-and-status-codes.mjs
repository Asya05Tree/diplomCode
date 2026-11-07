// §7 — CurrentUserId uses User.FindFirst(Sub)!.Value : a valid-signed JWT WITHOUT a
// `sub` claim -> NullReferenceException -> 500 instead of 401.
// §6 — status-code inconsistency: UPDATE of a non-existent id -> 400 invalid_transaction,
// DELETE of a non-existent id -> 404.
import crypto from 'node:crypto'
import { provision, api } from '../_lib/provision.mjs'

const KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function tokenWithoutSub() {
  const now = Math.floor(Date.now() / 1000)
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ email: 'nosub@gmail.com', iss: 'planner-api', aud: 'planner-client', exp: now + 3600, iat: now }) // NO sub
  const sig = crypto.createHmac('sha256', KEY).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${sig}`
}

console.log('--- validly-signed JWT with no `sub` claim ---')
const r = await api('GET', '/api/finance', { token: tokenWithoutSub() })
console.log('GET /api/finance (no sub) ->', r.status)
console.log(r.status >= 500 ? 'CONFIRMED: missing sub -> 500 (NullReferenceException), not 401.' : `handled -> ${r.status}`)

console.log('')
console.log('--- status-code inconsistency on a non-existent transaction id ---')
const u = await provision({ email: 'adv.t08.a@gmail.com', gender: 'female' })
const ghost = 2147480000
const upd = await api('PUT', `/api/finance/transactions/${ghost}`, { token: u.token, body: { amount: 1, type: 'Expense', category: 'food' } })
const del = await api('DELETE', `/api/finance/transactions/${ghost}`, { token: u.token })
console.log(`UPDATE ghost id -> ${upd.status} ${upd.json?.error || ''}`)
console.log(`DELETE ghost id -> ${del.status}`)
console.log((upd.status === 400 && del.status === 404)
  ? 'CONFIRMED: same "not found" condition yields 400 on update but 404 on delete (inconsistent contract).'
  : 'REFUTED')
