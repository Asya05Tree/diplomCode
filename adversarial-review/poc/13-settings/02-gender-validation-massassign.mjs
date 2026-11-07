// §6 (🟠) Gender NOT validated on server + §9 studentType validation + clamp ranges
// + mass-assignment of privileged UserProfile fields.
//
// HealthProfileController.cs:56  if (!IsNullOrWhiteSpace(Gender)) profile.Gender = Gender;  // ANY string
// HealthProfileController.cs:58  if (StudentType is "pupil"|"student"|"none") ...           // whitelisted
// HealthProfileController.cs:53-55 Height/Weight/BirthYear Math.Clamp(...)                   // clamped
// UpdateHealthProfileRequest has only 6 fields → Language/Theme/HistoryRetentionDays NOT bindable.
import { provision, api } from '../_lib/provision.mjs'
import { profileOf } from './_db.mjs'

const u = await provision({ email: 'adv.t13.massassign@gmail.com', gender: 'female', studentType: 'student' })

// --- A) arbitrary gender string accepted (emoji, junk, 5000 chars) ---
const junkGender = '💀'.repeat(10) + '<script>xyz</script>' + 'Z'.repeat(5000)
const rg = await api('PUT', '/api/health-profile', { token: u.token, body: { gender: junkGender } })
const afterG = profileOf(u.userId)
// Gender stored verbatim: thousands of chars incl. emoji/HTML; far beyond any sane enum.
const genderStored = rg.status === 200 && afterG.Gender.length > 1000 && afterG.Gender !== 'female'
console.log(`A) PUT junk gender (js-len=${junkGender.length}) status=${rg.status} → stored db-char-len=${afterG.Gender.length} head=${JSON.stringify(afterG.Gender.slice(0, 12))} accepted=${genderStored}`)

// --- B) invalid studentType silently ignored (stays 'student'), NOT rejected ---
const rs = await api('PUT', '/api/health-profile', { token: u.token, body: { studentType: 'HACKER', gender: 'female' } })
const afterS = profileOf(u.userId)
console.log(`B) PUT studentType='HACKER' status=${rs.status} → stored StudentType=${afterS.StudentType} (ignored, no 400)`)

// --- C) clamp ranges (defensive — should clamp, not reject) ---
const rc = await api('PUT', '/api/health-profile', {
  token: u.token,
  body: { height: 99999, weight: -50, birthYear: 3000, gender: 'female' },
})
const afterC = profileOf(u.userId)
console.log(`C) PUT height=99999 weight=-50 birthYear=3000 status=${rc.status} → Height=${afterC.Height} Weight=${afterC.Weight} BirthYear=${afterC.BirthYear}`)
const clamped = afterC.Height === '300' && afterC.Weight === '1' // birthYear clamps to now-120..now-1

// --- D) mass-assignment of privileged profile columns via PUT body ---
const beforeD = profileOf(u.userId)
const rd = await api('PUT', '/api/health-profile', {
  token: u.token,
  body: {
    gender: 'female',
    language: 'HACKED', Language: 'HACKED',
    theme: 'HACKED', Theme: 'HACKED',
    accentColor: '#000000', AccentColor: '#000000',
    historyRetentionDays: 99999, HistoryRetentionDays: 99999,
    dayStart: '00:00', DayStart: '00:00',
  },
})
const afterD = profileOf(u.userId)
const massAssigned = afterD.Language === 'HACKED' || afterD.Theme === 'HACKED' || afterD.HistoryRetentionDays === '99999' || afterD.AccentColor === '#000000'
console.log(`D) PUT privileged fields status=${rd.status} → Language=${afterD.Language} Theme=${afterD.Theme} HistoryRetentionDays=${afterD.HistoryRetentionDays} AccentColor=${afterD.AccentColor}`)
console.log(`   (before: Language=${beforeD.Language} Theme=${beforeD.Theme} HRD=${beforeD.HistoryRetentionDays} Accent=${beforeD.AccentColor})`)

console.log('\n==== RESULT ====')
console.log(`A) Gender accepts arbitrary string (§6 🟠): ${genderStored ? 'CONFIRMED (BROKEN)' : 'REFUTED'}`)
console.log(`B) Invalid studentType silently ignored (no 400): ${rs.status === 200 && afterS.StudentType === 'student' ? 'CONFIRMED (ignored, not rejected)' : 'see output'}`)
console.log(`C) Numeric fields clamped not rejected: ${clamped ? 'CONFIRMED (defensive clamp works)' : 'see output'}`)
console.log(`D) Mass-assign privileged profile fields: ${massAssigned ? 'CONFIRMED (BROKEN)' : 'REFUTED — not bindable (DTO has 6 fields)'}`)
