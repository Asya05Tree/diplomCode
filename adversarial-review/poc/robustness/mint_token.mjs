// Mints an HS256 JWT accepted by the running API, for an isolated throwaway user.
// Uses the dev secret from server/appsettings.json (Jwt:Key). LOCAL ADVERSARIAL PoC ONLY.
//   node mint_token.mjs <userId> [email]
import crypto from 'node:crypto'

const userId = process.argv[2] || '31'
const email = process.argv[3] || 'adv_robustness_poc@gmail.com'
const KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION'
const ISS = 'planner-api'
const AUD = 'planner-client'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const header = { alg: 'HS256', typ: 'JWT' }
const payload = {
  sub: String(userId),
  email,
  iss: ISS,
  aud: AUD,
  exp: now + 3600 * 24,
  iat: now,
}
const signingInput = `${b64(header)}.${b64(payload)}`
const sig = crypto.createHmac('sha256', KEY).update(signingInput).digest('base64url')
process.stdout.write(`${signingInput}.${sig}`)
