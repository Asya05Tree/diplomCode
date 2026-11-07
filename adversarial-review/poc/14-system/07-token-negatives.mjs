// §6 — Negative controls proving the signature/lifetime validation itself is CORRECT,
// which is precisely why the committed key (01-jwt-forgery) is the whole ballgame.
//  (a) alg:none unsigned token      -> must be 401
//  (b) token signed with WRONG key  -> must be 401
//  (c) expired token (committed key) -> must be 401 (ValidateLifetime=true)
//
// Run: node 07-token-negatives.mjs
import crypto from 'node:crypto'
import { provision, api } from '../_lib/provision.mjs'

const line = (s = '') => process.stdout.write(s + '\n')
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const ISS = 'planner-api', AUD = 'planner-client'

const u = await provision({ email: 'adv.t14.neg@gmail.com', nickname: 'Neg', gender: 'female' })
const now = Math.floor(Date.now() / 1000)

function sign(payload, key, alg = 'HS256') {
  const header = b64({ alg, typ: 'JWT' })
  const body = b64(payload)
  if (alg === 'none') return `${header}.${body}.`
  const sig = crypto.createHmac('sha256', key).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

const base = { sub: String(u.userId), email: u.email, iss: ISS, aud: AUD }

const noneTok = sign({ ...base, exp: now + 3600, iat: now }, null, 'none')
const wrongTok = sign({ ...base, exp: now + 3600, iat: now }, 'some-other-key-entirely')
// expired by 1h — comfortably beyond the default 5-min ClockSkew tolerance
const expiredTok = sign({ ...base, exp: now - 3600, iat: now - 7200 }, 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION')

const a = await api('GET', '/api/auth/me', { token: noneTok })
const b = await api('GET', '/api/auth/me', { token: wrongTok })
const c = await api('GET', '/api/auth/me', { token: expiredTok })

line(`(a) alg:none            /api/auth/me -> ${a.status}  ${a.status === 401 ? 'rejected ✓' : 'ACCEPTED ✗'}`)
line(`(b) wrong-key signature /api/auth/me -> ${b.status}  ${b.status === 401 ? 'rejected ✓' : 'ACCEPTED ✗'}`)
line(`(c) expired (right key) /api/auth/me -> ${c.status}  ${c.status === 401 ? 'rejected ✓' : 'ACCEPTED ✗'}`)

const ok = a.status === 401 && b.status === 401 && c.status === 401
line('\n==============================================================')
line(`VERDICT: ${ok ? 'validation CORRECT ⚪ (as expected)' : 'VALIDATION BROKEN 🔴'}`)
line('  Signature + lifetime validation work -> the ONLY reason forgery (PoC 01) succeeds')
line('  is that the signing key is a committed, publicly-known placeholder.')
