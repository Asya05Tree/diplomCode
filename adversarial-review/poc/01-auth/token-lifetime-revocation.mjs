// §7: 90-day token, no jti, no server-side revocation. "Logout" is client-only.
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t01.revoke@gmail.com', nickname: 'Revoke', gender: 'female' })
const payload = JSON.parse(Buffer.from(u.token.split('.')[1], 'base64url').toString())
const nowSec = Math.floor(Date.now() / 1000)
const lifeDays = Math.round((payload.exp - nowSec) / 86400)
console.log(`[info] token claims: ${JSON.stringify(payload)}`)
console.log(`[info] lifetime from now until exp = ${lifeDays} days; jti present = ${'jti' in payload}`)

// Simulate "logout": client only does localStorage.removeItem — the token itself is untouched.
// Re-use the SAME token string afterwards:
const after = await api('GET', '/api/auth/me', { token: u.token })
console.log(`[attack] after client-side logout, reuse same token -> GET /me = ${after.status} ${after.text}`)

const ok = lifeDays >= 89 && !('jti' in payload) && after.status === 200
console.log(ok
  ? `CONFIRMED: token lives ${lifeDays} days, has no jti, and stays valid after logout (observed /me=200). Expected: short-lived or server-revocable session. A leaked token is usable for ~90 days with no way to revoke.`
  : `NOT CONFIRMED`)
