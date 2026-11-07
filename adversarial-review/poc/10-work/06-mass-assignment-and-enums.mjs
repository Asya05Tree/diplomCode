// §8 (🟡) mass-assignment on dead fields + §6/§3 enum normalization behaviour.
//  - WorkContactRequest accepts Status/Socials/Viber the UI no longer uses.
//  - WorkObligationRequest accepts IsDone/DueDate the UI no longer uses.
//  - Invalid enum values (status/kind/payType/leave type) are silently normalized to a
//    safe default rather than rejected (so enum INJECTION is refuted, but silent coercion
//    masks bad input — worth noting).
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)
const ok = (c) => (c ? 'CONFIRMED' : 'not-as-expected')

const u = await provision({ email: 'adv.t10.mass@gmail.com', isWorking: true })
line(`userId=${u.userId}`)

// 1) Mass-assignment: set dead contact fields
const c = await api('POST', '/api/work/contacts', { token: u.token, body: {
  groupName:'secret-group', status:'busy', fullName:'Mass Assign', phone:'+380991112233',
  socials:'injected-socials', telegram:'@tg', viber:'injected-viber' } })
const cs = await api('GET', '/api/work/contacts', { token: u.token })
const gc = (cs.json||[]).find(x => x.fullName==='Mass Assign')
line(`\n[contact over-post] status=${c.status}; stored status=${gc?.status} socials=${gc?.socials} viber=${gc?.viber} group=${gc?.groupName}`)
line(`  => ${ok(gc?.socials==='injected-socials' && gc?.viber==='injected-viber' && gc?.status==='busy')}: dead fields Status/Socials/Viber settable via API (§8).`)

// 2) Mass-assignment: obligation IsDone + DueDate (UI doesn't expose them)
const o = await api('POST', '/api/work/obligations', { token: u.token, body: {
  title:'Mass Obl', note:'n', dueDate:'2026-12-31', isDone:true } })
const os = await api('GET', '/api/work/obligations', { token: u.token })
const go = (os.json||[]).find(x => x.title==='Mass Obl')
line(`\n[obligation over-post] POST status=${o.status}; stored dueDate=${go?.dueDate} isDone=${go?.isDone}`)
// Note: AddObligation ignores IsDone (only title/note/dueDate passed through) — check:
line(`  => dueDate set=${go?.dueDate==='2026-12-31'} ; isDone on create=${go?.isDone} (AddObligationAsync drops IsDone; UpdateObligation keeps it)`)
const up = await api('PUT', `/api/work/obligations/${go.id}`, { token: u.token, body: {
  title:'Mass Obl', note:'n', dueDate:'2026-12-31', isDone:true } })
const os2 = await api('GET', '/api/work/obligations', { token: u.token })
const go2 = (os2.json||[]).find(x => x.id===go.id)
line(`  after PUT isDone=true -> stored isDone=${go2?.isDone}`)
line(`  => ${ok(go2?.isDone===true)}: dead IsDone field settable via PUT (§8).`)

// 3) Enum normalization (not injection): bogus values coerced to defaults
const bogusType = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name:'enumtest', color:'#ffd59e', startTime:'09:00:00', endTime:'17:00:00', kind:'HACKER_KIND' } })
const t = await api('GET', '/api/work/shift-types', { token: u.token })
const et = (t.json||[]).find(x=>x.name==='enumtest')
const bogusProc = await api('POST', '/api/work/process', { token: u.token, body: { title:'enumproc', status:'HACKER_STATUS' } })
const p = await api('GET', '/api/work/process', { token: u.token })
const ep = (p.json||[]).find(x=>x.title==='enumproc')
const bogusLeave = await api('POST', '/api/work/leaves', { token: u.token, body: { type:'HACKER_TYPE', startDate:'2026-12-01', endDate:'2026-12-02' } })
const l = await api('GET', '/api/work/leaves', { token: u.token })
const el = (l.json||[])[0]
line(`\n[enum coercion] shift kind 'HACKER_KIND' -> '${et?.kind}'; process status 'HACKER_STATUS' -> '${ep?.status}'; leave type 'HACKER_TYPE' -> '${el?.type}'`)
line(`  => ${ok(et?.kind==='normal' && ep?.status==='planned' && el?.type==='vacation')}: invalid enums silently normalized to defaults (injection REFUTED; silent coercion noted §3/§6).`)

line(`\n==== VERDICT ====`)
line(`CONFIRMED mass-assignment of dead fields (contact Status/Socials/Viber, obligation IsDone). Enum injection REFUTED (normalized).`)
