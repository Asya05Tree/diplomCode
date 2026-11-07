// §7: forged-but-validly-signed token with non-numeric sub -> int.Parse throws -> 500.
import { api } from '../_lib/provision.mjs'
import crypto from 'node:crypto'

const KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function mintRaw(sub) {
  const now = Math.floor(Date.now() / 1000)
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ sub, email: 'x@gmail.com', iss: 'planner-api', aud: 'planner-client', exp: now + 3600, iat: now })
  const s = crypto.createHmac('sha256', KEY).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${s}`
}

const r = await api('GET', '/api/auth/me', { token: mintRaw('not-a-number') })
console.log(`[attack] token with sub="not-a-number" -> GET /me = ${r.status}`)
console.log(`[body] ${r.text.slice(0, 300)}`)
const ok = r.status >= 500
console.log(ok
  ? `CONFIRMED: non-numeric sub in a validly-signed token causes ${r.status} (int.Parse(sub) throws, AuthController.cs:135). Expected 400/401. Unhandled server exception.`
  : `NOT CONFIRMED: status=${r.status} (int.Parse may be guarded)`)
