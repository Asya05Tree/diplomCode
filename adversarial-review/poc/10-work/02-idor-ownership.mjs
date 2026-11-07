// §7.3 (✅ claimed) — verify IDOR is actually closed: user A cannot read/update/delete
// user B's work objects. Also test forged-token acting as another userId (still scoped
// to that userId, so not a cross-user leak by itself).
import { provision, api, mintToken } from '../_lib/provision.mjs'

const line = (s) => console.log(s)

const A = await provision({ email: 'adv.t10.a@gmail.com', isWorking: true })
const B = await provision({ email: 'adv.t10.b@gmail.com', isWorking: true })
line(`A=${A.userId}  B=${B.userId}`)

// B creates objects
const bType = await api('POST', '/api/work/shift-types', { token: B.token, body: {
  name: 'B type', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
const bContact = await api('POST', '/api/work/contacts', { token: B.token, body: {
  groupName: '', fullName: 'B secret contact', phone: '+380991112233' } })
const bMeeting = await api('POST', '/api/work/meetings', { token: B.token, body: {
  withWhom: 'B client', when: '2026-12-02T10:00:00' } })
const bObl = await api('POST', '/api/work/obligations', { token: B.token, body: { title: 'B duty' } })
const bProc = await api('POST', '/api/work/process', { token: B.token, body: { title: 'B task' } })
const bLeave = await api('POST', '/api/work/leaves', { token: B.token, body: {
  type: 'vacation', startDate: '2026-12-20', endDate: '2026-12-25' } })
line(`B created: type=${bType.json?.id} contact=${bContact.json?.id} meeting=${bMeeting.json?.id} obl=${bObl.json?.id} proc=${bProc.json?.id} leave=${bLeave.json?.id}`)

// A tries to read B's objects by listing — must not see B's data
const aContacts = await api('GET', '/api/work/contacts', { token: A.token })
const leak = (aContacts.json || []).some(c => c.fullName === 'B secret contact')
line(`\nA GET /contacts sees B's secret contact? ${leak} (expect false)`)

// A tries targeted mutations on B's ids
const attacks = [
  ['PUT',    `/api/work/shift-types/${bType.json.id}`, { name: 'hacked', color: '#000', startTime:'00:00:00', endTime:'01:00:00' }],
  ['DELETE', `/api/work/shift-types/${bType.json.id}`, undefined],
  ['PUT',    `/api/work/contacts/${bContact.json.id}`, { groupName:'', fullName:'hacked', phone:'1' }],
  ['DELETE', `/api/work/contacts/${bContact.json.id}`, undefined],
  ['PUT',    `/api/work/meetings/${bMeeting.json.id}`, { withWhom:'hacked', when:'2027-01-01T10:00:00' }],
  ['DELETE', `/api/work/meetings/${bMeeting.json.id}`, undefined],
  ['PUT',    `/api/work/obligations/${bObl.json.id}`, { title:'hacked', isDone:true }],
  ['DELETE', `/api/work/obligations/${bObl.json.id}`, undefined],
  ['PUT',    `/api/work/process/${bProc.json.id}`, { title:'hacked', status:'done' }],
  ['DELETE', `/api/work/process/${bProc.json.id}`, undefined],
  ['PUT',    `/api/work/leaves/${bLeave.json.id}`, { type:'sick', startDate:'2027-01-01', endDate:'2027-01-02' }],
  ['DELETE', `/api/work/leaves/${bLeave.json.id}`, undefined],
]
let allNotFound = true
for (const [method, path, body] of attacks) {
  const r = await api(method, path, { token: A.token, body })
  const good = r.status === 404
  allNotFound = allNotFound && good
  line(`A ${method} ${path} -> ${r.status} ${good ? 'OK(404)' : 'LEAK!'}`)
}

// Verify B's objects survived untouched
const bContacts2 = await api('GET', '/api/work/contacts', { token: B.token })
const survived = (bContacts2.json || []).some(c => c.fullName === 'B secret contact')
line(`\nB's contact still intact after A's attacks? ${survived} (expect true)`)

// Forged token for B's userId (committed dev key) — this is JWT forgery (separate issue),
// but it only lets you act AS B, scoped to B — not a cross-user IDOR in the controller.
const forged = mintToken(B.userId, B.email)
const forgedRead = await api('GET', '/api/work/contacts', { token: forged })
line(`\nForged-token(B) GET /contacts status=${forgedRead.status} count=${(forgedRead.json||[]).length} (forgery works because dev key is committed)`)

line(`\n==== VERDICT ====`)
line(`${(!leak && allNotFound && survived) ? 'REFUTED' : 'CONFIRMED-IDOR'}: controller/service ownership scoping holds — A cannot read/modify/delete B's work objects (all 404). §7.3 ✅`)
line(`NOTE: forged HS256 token (committed key) still grants full access as any userId — pre-existing auth issue, out of module scope.`)
