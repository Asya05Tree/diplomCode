// §6 / §7 / §3 — status codes & validation: empty/whitespace title, invalid action,
// DateOnly garbage (400 vs 500?), endDate null / year overflow, no-token 401, forged-token &
// token-without-sub (401 vs 500 via User.FindFirst(Sub)! / int.Parse).
import { provision, api, mintToken } from '../_lib/provision.mjs'
import crypto from 'node:crypto'

const A = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })
const today = new Date().toISOString().slice(0, 10)
const end = new Date(Date.now() + 100 * 86400000).toISOString().slice(0, 10)
const out = []
const line = (label, got, expect) => { out.push({ label, got, expect, ok: expect.includes(got) }); console.log(`${label}: ${got}  (expect ${expect.join('/')})`) }

// --- validation ---
line('create empty Title', (await api('POST', '/api/tasks', { token: A.token, body: { Title: '' } })).status, [400])
line('create whitespace Title "   "', (await api('POST', '/api/tasks', { token: A.token, body: { Title: '   ' } })).status, [400])
line('resolve invalid Action "Planned"', (await api('POST', `/api/tasks/999999/resolve`, { token: A.token, body: { Action: 'Planned' } })).status, [400])
line('GET day?date=abc (DateOnly garbage)', (await api('GET', '/api/tasks/day?date=abc', { token: A.token })).status, [400])
line('GET period?from=abc&to=xyz', (await api('GET', '/api/tasks/period?from=abc&to=xyz', { token: A.token })).status, [400])
line('create rule endDate=null', (await api('POST', '/api/recurrence-rules', { token: A.token, body: {
  Title: 'r', Type: 'EveryNDays', TimeOfDay: '09:00:00', StartDate: today, EndDate: null, IntervalDays: 1 } })).status, [400])
line('create rule endDate > start+1yr', (await api('POST', '/api/recurrence-rules', { token: A.token, body: {
  Title: 'r', Type: 'EveryNDays', TimeOfDay: '09:00:00', StartDate: today, EndDate: '2099-01-01', IntervalDays: 1 } })).status, [400])
line('create rule StartDate year 9999 (overflow-ish)', (await api('POST', '/api/recurrence-rules', { token: A.token, body: {
  Title: 'r', Type: 'EveryNDays', TimeOfDay: '09:00:00', StartDate: '9999-01-01', EndDate: '9999-06-01', IntervalDays: 1 } })).status, [200, 400])

// --- auth ---
line('no token → GET day', (await api('GET', `/api/tasks/day?date=${today}`, {})).status, [401])
line('garbage token → GET day', (await api('GET', `/api/tasks/day?date=${today}`, { token: 'not.a.jwt' })).status, [401])

// forged token with the committed dev key, arbitrary userId
const forged = mintToken(999999, 'ghost@gmail.com')
line('FORGED token (dev key) arbitrary userId → GET day', (await api('GET', `/api/tasks/day?date=${today}`, { token: forged })).status, [200])

// token with NO sub claim — does CurrentUserId => User.FindFirst(Sub)! throw 500?
const KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const h = b64({ alg: 'HS256', typ: 'JWT' })
const p = b64({ email: 'nosub@gmail.com', iss: 'planner-api', aud: 'planner-client', exp: now + 3600, iat: now })
const sig = crypto.createHmac('sha256', KEY).update(`${h}.${p}`).digest('base64url')
const noSub = `${h}.${p}.${sig}`
const noSubRes = await api('GET', `/api/tasks/day?date=${today}`, { token: noSub })
line('token WITHOUT sub claim → GET day (401 good / 500 bad)', noSubRes.status, [401])

console.log('\n--- summary ---')
const forgedOk = out.find(o => o.label.startsWith('FORGED'))?.got === 200
const noSubBad = noSubRes.status >= 500
const garbage400 = out.find(o => o.label.includes('DateOnly garbage'))
for (const o of out) if (!o.ok) console.log(`DEVIATION: ${o.label} → got ${o.got}, expected ${o.expect.join('/')}`)
console.log('\nFORGED token (committed HS256 key) accepted as arbitrary user:', forgedOk ? 'CONFIRMED (CRITICAL)' : 'no')
console.log('token-without-sub causes 500 (unhandled):', noSubBad ? 'CONFIRMED' : `no (got ${noSubRes.status})`)
