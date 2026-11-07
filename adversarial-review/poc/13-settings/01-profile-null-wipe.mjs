// §1 (🔴) FLAGSHIP — Changing gender / study-status in Settings SILENTLY NULLS
// height, weight and birthYear in the health profile.
//
// Root cause: client setHealthProfile({ gender }) (api/healthProfile.js:8-9) builds a
// body { height, weight, birthYear, gender, studentType, isWorking } where the omitted
// fields are `undefined` → JSON.stringify DROPS them. Server UpdateProfile
// (HealthProfileController.cs:53-55) UNCONDITIONALLY writes
//   profile.Height = request.Height is double ? clamp : null   (and Weight, BirthYear)
// so a missing field is treated as null and OVERWRITES the stored value. Gender/
// StudentType/IsWorking have a protective `if`, the three numeric fields do NOT.
//
// We reproduce the EXACT wire bytes the client sends (fields literally absent), not a
// manual {height:null}. Expected (correct) behaviour: toggling gender leaves height/
// weight/birthYear intact. Observed: they become NULL.
import { provision, api } from '../_lib/provision.mjs'
import { profileOf } from './_db.mjs'

const u = await provision({ email: 'adv.t13.nullwipe@gmail.com', gender: 'female', studentType: 'student', isWorking: true })

// 1) User fills in height/weight/birthYear in the "Health" tab (full PUT with all fields).
await api('PUT', '/api/health-profile', {
  token: u.token,
  body: { height: 170, weight: 65, birthYear: 1998, gender: 'female', studentType: 'student', isWorking: true },
})
const before = profileOf(u.userId)
console.log('After Health tab save:', before)

// 2) User opens Settings → "Користувач" and clicks a GENDER button.
//    App.handleSetGender → setHealthProfile({ gender: 'male' }) → body with ONLY gender.
//    We serialize the same way the browser does: undefined fields vanish from JSON.
const genderBody = JSON.parse(JSON.stringify({
  height: undefined, weight: undefined, birthYear: undefined,
  gender: 'male', studentType: undefined, isWorking: undefined,
}))
console.log('Wire body the client actually sends on gender toggle:', JSON.stringify(genderBody))
const r1 = await api('PUT', '/api/health-profile', { token: u.token, body: genderBody })
const afterGender = profileOf(u.userId)
console.log(`PUT (gender toggle) status=${r1.status} →`, afterGender)

// 3) Re-fill, then toggle STUDY STATUS (handleSetStudyStatus sends only studentType+isWorking).
await api('PUT', '/api/health-profile', {
  token: u.token,
  body: { height: 170, weight: 65, birthYear: 1998, gender: 'male', studentType: 'student', isWorking: true },
})
const studyBody = JSON.parse(JSON.stringify({
  height: undefined, weight: undefined, birthYear: undefined,
  gender: undefined, studentType: 'none', isWorking: false,
}))
console.log('\nWire body on study-status toggle:', JSON.stringify(studyBody))
const r2 = await api('PUT', '/api/health-profile', { token: u.token, body: studyBody })
const afterStudy = profileOf(u.userId)
console.log(`PUT (study toggle) status=${r2.status} →`, afterStudy)

const genderWiped = before.Height !== 'NULL' && afterGender.Height === 'NULL' && afterGender.Weight === 'NULL' && afterGender.BirthYear === 'NULL'
const studyWiped = afterStudy.Height === 'NULL' && afterStudy.Weight === 'NULL' && afterStudy.BirthYear === 'NULL'

console.log('\n==== RESULT (§1 🔴) ====')
console.log(`Expected: toggling gender/study keeps Height=170 Weight=65 BirthYear=1998`)
console.log(`Observed: gender toggle → Height=${afterGender.Height} Weight=${afterGender.Weight} BirthYear=${afterGender.BirthYear}`)
console.log(`Observed: study  toggle → Height=${afterStudy.Height} Weight=${afterStudy.Weight} BirthYear=${afterStudy.BirthYear}`)
console.log(`Gender toggle nulls numeric fields: ${genderWiped ? 'CONFIRMED (BROKEN)' : 'REFUTED'}`)
console.log(`Study  toggle nulls numeric fields: ${studyWiped ? 'CONFIRMED (BROKEN)' : 'REFUTED'}`)
