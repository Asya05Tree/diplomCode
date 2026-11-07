// §6 / §8 / §10 — data boundaries:
//  - CustomText has no length cap (longtext) -> 5000-char name accepted.
//  - name stored RAW (XSS payload persisted; UI relies on React escaping at render).
//  - nonexistent productId -> 500 (FK violation), not 400 / graceful.
//  - token without `sub` claim -> 500 NullReferenceException (CurrentUserId int.Parse(...!)).
import { provision, api } from '../_lib/provision.mjs'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const A = await provision({ email: 'adv.t05.limits@gmail.com' })
const db = (sql) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', sql], { encoding: 'utf8' }).trim()

// 1) very long name
const longId = (await api('POST', '/api/shopping-list', { token: A.token, body: { section: 'Groceries', text: 'Ж'.repeat(5000) } })).json.id
const len = db(`SELECT CHAR_LENGTH(CustomText) FROM ShoppingItems WHERE Id=${longId};`)
console.log(`[long name] stored length=${len} (expected capped, e.g. <=120). ` +
  (Number(len) === 5000 ? 'CONFIRMED: no length limit on CustomText (longtext).' : 'REFUTED'))

// 2) XSS payload stored raw
const xss = '<img src=x onerror=alert(1)>'
const xId = (await api('POST', '/api/shopping-list', { token: A.token, body: { section: 'Groceries', text: xss } })).json.id
const stored = db(`SELECT CustomText FROM ShoppingItems WHERE Id=${xId};`)
console.log(`[xss] stored = ${stored}`)
console.log(stored === xss ? 'CONFIRMED: payload persisted verbatim (no sanitization; safe only while every consumer escapes — React does at render).'
  : 'REFUTED')

// 3) nonexistent productId
const bp = await api('POST', '/api/shopping-list', { token: A.token, body: { section: 'Groceries', productId: 999999999 } })
console.log(`[bad productId] HTTP ${bp.status} (expected 400). ` +
  (bp.status === 500 ? 'CONFIRMED: no existence check -> FK violation 500 (ShoppingService.cs:122-142).'
    : bp.status === 400 ? 'REFUTED (rejected cleanly)' : `observed ${bp.status}`))

// 4) token missing `sub`
const KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const h = b64({ alg: 'HS256', typ: 'JWT' })
const p = b64({ email: 'x@gmail.com', iss: 'planner-api', aud: 'planner-client', exp: now + 3600, iat: now })
const sig = crypto.createHmac('sha256', KEY).update(`${h}.${p}`).digest('base64url')
const r = await api('GET', '/api/shopping-list', { token: `${h}.${p}.${sig}` })
console.log(`[no-sub token] HTTP ${r.status} (expected 401). body: ${r.text.split('\n')[0].slice(0, 70)}`)
console.log(r.status === 500 ? 'CONFIRMED: CurrentUserId int.Parse(sub!) -> NullReferenceException 500 instead of 401 (ShoppingListController.cs:27).'
  : 'REFUTED')
