// §6-M / §10-M — Server silently CLAMPS text >280 instead of returning 400.
// NotesController.cs:79-83 Clamp(): text[..280]; no BadRequest. Also tests UTF-16 split:
// clamping by code units can split an emoji (surrogate pair) → mojibake in DB.
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t12.a@gmail.com', gender: 'female' })

// 1) Over-length text: fixed server now REJECTS with 400 ([StringLength(280)]) instead of silently truncating
const long = 'x'.repeat(500)
const add = await api('POST', '/api/notes', { token: u.token, body: { text: long, color: '#fff3b0' } })
const id = add.json?.id
let stored = id ? (await api('GET', '/api/notes', { token: u.token })).json.find((n) => n.id === id)?.text : undefined
console.log(`sent length=500  status=${add.status}  storedLength=${stored?.length ?? 'n/a (rejected)'}`)
console.log(`EXPECTED: 400 BadRequest on >280`)
console.log(`OBSERVED: ${add.status}${add.status === 200 ? ` OK, silently truncated to ${stored?.length}` : ' rejected (no row stored)'}`)
const clampConfirmed = add.status === 200 && stored?.length === 280

// 2) Surrogate-pair split: 279 'a' + one emoji (💥 = 2 UTF-16 units) => 281 units. >280 => also rejected now.
const emoji = 'a'.repeat(279) + '💥'
const add2 = await api('POST', '/api/notes', { token: u.token, body: { text: emoji, color: '#fff3b0' } })
const id2 = add2.json?.id
const stored2 = id2 ? (await api('GET', '/api/notes', { token: u.token })).json.find((n) => n.id === id2)?.text : undefined
const lastCode = stored2 ? stored2.charCodeAt(stored2.length - 1) : 0
const brokenSurrogate = lastCode >= 0xD800 && lastCode <= 0xDBFF
console.log(`\nemoji test: sent 279a+💥 (281 units) status=${add2.status} storedLength=${stored2?.length ?? 'n/a (rejected)'}`)
console.log(`broken half-surrogate stored: ${brokenSurrogate}`)

console.log(clampConfirmed ? '\nCONFIRMED 🟡 — >280 silently clamped (no 400); surrogate halves possible' : '\nREFUTED ✅ — >280 rejected with 400; no silent truncation / surrogate split')
