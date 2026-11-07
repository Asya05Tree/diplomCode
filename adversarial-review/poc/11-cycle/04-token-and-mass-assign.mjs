// TAB 11 §7/§6 — token without `sub` -> 500 (not 401); garbage HygieneProduct accepted (no 400);
// GET auto-creates a settings row for a male (side-effect write).
import { provision, api } from '../_lib/provision.mjs'
import crypto from 'node:crypto'

const KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function tokenNoSub() {
  const now = Math.floor(Date.now() / 1000)
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const payload = b64({ email: 'nosub@gmail.com', iss: 'planner-api', aud: 'planner-client', exp: now + 3600, iat: now }) // NO sub
  const sig = crypto.createHmac('sha256', KEY).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

const ns = await api('GET', '/api/cycle', { token: tokenNoSub() })
console.log('(NO-SUB) valid signature, missing `sub` claim:')
console.log(`   GET /api/cycle -> HTTP ${ns.status}  body=${ns.text?.slice(0, 140)}`)
console.log(`   ${ns.status >= 500 ? 'CONFIRMED: int.Parse(sub!) NREs -> 500 instead of 401' : 'status ' + ns.status}`)

// garbage/oversized HygieneProduct — no ModelState validation -> 200, silently nulled
const u = await provision({ email: 'adv.t11.mass@gmail.com', nickname: 'Mass', gender: 'female' })
const junk = 'x'.repeat(5000) + '<script>alert(1)</script>'
const put = await api('PUT', '/api/cycle/settings', { token: u.token, body: { reduceLoadOnHeavyDays: true, hygieneProduct: junk } })
const back = (await api('GET', '/api/cycle', { token: u.token })).json.settings
console.log('\n(MASS-ASSIGN / VALIDATION) 5KB junk HygieneProduct:')
console.log(`   PUT /settings -> HTTP ${put.status}; stored hygieneProduct = ${JSON.stringify(back.hygieneProduct)}`)
console.log(`   ${put.status === 200 && back.hygieneProduct === null ? 'CONFIRMED: arbitrary string accepted (200, no 400); silently coerced to null (whitelist on store, not on input)' : 'see above'}`)

// Extra body fields ignored (DTO binding) — try injecting UserId/Id
const inj = await api('POST', '/api/cycle/records', { token: u.token, body: { startDate: '2026-09-01', userId: 999999, id: 123456 } })
const list = (await api('GET', '/api/cycle', { token: u.token })).json.records
console.log('\n(MASS-ASSIGN) inject userId/id in body:')
console.log(`   POST /records {startDate, userId:999999, id:123456} -> HTTP ${inj.status}, returned id=${inj.json?.id}`)
console.log(`   ${inj.json?.id !== 123456 ? 'REFUTED: Id/UserId not bindable from body (DTO limits mass assignment)' : 'CONFIRMED: id honored from body!'}`)
for (const r of list) await api('DELETE', `/api/cycle/records/${r.id}`, { token: u.token })
