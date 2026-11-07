// §6/§8/§9/§10: AddVisit does not validate DoctorKey against the 16-item list; no server MAX_LEN.
// Arbitrary doctorKey => orphan visit (not shown under any known doctor in Health UI) + a calendar task.
// doctorName/place/note stored as-is (client controls calendar event title/description); huge payloads accepted.
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

const q = (sql) => execFileSync('docker', ['exec','planner-mysql','mysql','-N','-uplanner','-pplanner_dev_password','planner','-e',sql], { encoding:'utf8' }).trim()

const u = await provision({ email: 'adv.t07.doc@gmail.com' })

const big = 'Ы'.repeat(5000)
const xssName = '<img src=x onerror=alert(1)>Dr\nEVIL'
const r = await api('POST', '/api/checkup/visits', { token: u.token, body: {
  doctorKey: 'totally-unknown-key-🦷',
  doctorName: xssName,
  when: '2030-01-01T10:00:00',
  place: 'Place' + big,
  note: 'Note' + big,
} })
console.log(`[POST visit, bogus doctorKey + 5KB place/note + HTML doctorName] -> ${r.status} id=${r.json?.id}`)
const id = r.json?.id

// Is it returned by GET visits (yes, by data) but orphaned in UI (doctorKey not in CHECKUP_DOCTORS)?
const vis = await api('GET', '/api/checkup/visits', { token: u.token })
const mine = (vis.json || []).find((v) => v.id === id)
console.log(`[GET visits] stored doctorKey="${mine?.doctorKey}"  place.len=${mine?.place?.length}  note.len=${mine?.note?.length}`)

// Inspect the generated calendar task (title/description) directly in DB.
const row = q(`SELECT Title, LENGTH(Description) FROM Tasks WHERE UserId=${u.userId} AND ModuleCode='health' ORDER BY Id DESC LIMIT 1;`)
console.log(`[DB Tasks row] Title | Description-bytes:`)
console.log('  ' + row.replace(/\n/g,' | '))

console.log('---')
const bogusAccepted = r.status === 200 && mine?.doctorKey?.startsWith('totally-unknown')
const bigAccepted = (mine?.place?.length ?? 0) > 1000
const htmlStored = row.includes('<img') || row.includes('EVIL')
if (bogusAccepted) console.log('CONFIRMED: arbitrary DoctorKey accepted (CheckupController.cs:32 only checks IsNullOrWhiteSpace). UI shows only 16 known keys => orphan visit cancellable only from calendar.')
if (bigAccepted) console.log('CONFIRMED: no server MAX_LEN — 5KB place/note persisted (CheckupService.cs: no length limit; HealthVisit.Place/Note no [MaxLength]).')
if (htmlStored) console.log('CONFIRMED: client-controlled doctorName/HTML stored verbatim into calendar task Title/Description (CheckupService.cs:43-44). Stored-XSS sink if any non-React renderer (iCal/email/PDF) emits it unescaped.')
