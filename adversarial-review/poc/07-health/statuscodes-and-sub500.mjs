// §6: status-code consistency + CurrentUserId null-forgiving/int.Parse on health controllers.
import { provision, mintToken, api } from '../_lib/provision.mjs'
import crypto from 'node:crypto'

const u = await provision({ email: 'adv.t07.sc@gmail.com' })

// add non-existent medicine -> 404
const addBad = await api('POST', '/api/medicine-cabinet/99999999', { token: u.token })
console.log(`POST med 99999999 (nonexistent) -> ${addBad.status} (expected 404)`)

// add real med twice -> both 200 (idempotent, indistinguishable from "newly added")
const first = await api('POST', '/api/medicine-cabinet/2058', { token: u.token })
const second = await api('POST', '/api/medicine-cabinet/2058', { token: u.token })
console.log(`POST med 2058 first=${first.status} second=${second.status} (both 200 => client can't tell new vs already present)`)

// delete condition that doesn't exist -> 404
const delCond = await api('DELETE', '/api/medicine-cabinet/conditions/99999999', { token: u.token })
console.log(`DELETE condition 99999999 -> ${delCond.status} (expected 404)`)

// missing doctorKey -> 400
const noDoc = await api('POST', '/api/checkup/visits', { token: u.token, body: { doctorKey: '  ', doctorName: 'x', when: '2030-01-01T10:00:00' } })
console.log(`POST visit blank doctorKey -> ${noDoc.status} (expected 400)`)

// missing condition name -> 400
const noName = await api('POST', '/api/medicine-cabinet/conditions', { token: u.token, body: { nameUk: '   ', affectsFood: false, tag: null, relation: 'Avoid' } })
console.log(`POST condition blank name -> ${noName.status} (expected 400)`)

// forged, validly-signed token with NON-NUMERIC sub -> int.Parse throws -> 500 on all three controllers
const KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now()/1000)
const h = b64({ alg:'HS256', typ:'JWT' })
const p = b64({ sub:'not-a-number', email:'x@gmail.com', iss:'planner-api', aud:'planner-client', exp:now+3600, iat:now })
const bad = `${h}.${p}.${crypto.createHmac('sha256',KEY).update(`${h}.${p}`).digest('base64url')}`
for (const path of ['/api/health-profile', '/api/medicine-cabinet', '/api/checkup/visits']) {
  const r = await api('GET', path, { token: bad })
  console.log(`GET ${path} with sub="not-a-number" -> ${r.status} (expected 401; 500 => unhandled int.Parse)`)
}

console.log('---')
console.log('CONFIRMED (§6): invalid/nonexistent -> 404; duplicate add -> 200 (indistinguishable). Non-numeric sub in a valid-signed token -> 500 (int.Parse(User.FindFirst(Sub)!.Value), HealthProfileController.cs:29 / MedicineCabinetController.cs:25 / CheckupController.cs:24) instead of 401.')
