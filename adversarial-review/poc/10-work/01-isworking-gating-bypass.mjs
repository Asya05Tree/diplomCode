// §7.1 (🔴) — TOP PRIORITY: prove the Work module is NOT gated server-side.
// Provision an account with isWorking:false (UI hides the whole /app/work route and
// the sidebar entry). Then call the /api/work/* endpoints the UI hides and show they
// return 200 + perform real mutations.
import { provision, api } from '../_lib/provision.mjs'

const line = (s) => console.log(s)
const ok = (cond) => (cond ? 'CONFIRMED' : 'not-as-expected')

const u = await provision({ email: 'adv.t10.gate@gmail.com', gender: 'female', studentType: null, isWorking: false })
line(`Provisioned NON-working account userId=${u.userId} isWorking=false`)

// 0) Sanity: confirm the server really thinks this user is not working.
const prof = await api('GET', '/api/health-profile', { token: u.token })
line(`\n[health-profile] status=${prof.status} isWorking=${JSON.stringify(prof.json?.isWorking)}`)

// 1) GET settings (read) — should be blocked for non-working, but...
const s = await api('GET', '/api/work/settings', { token: u.token })
line(`\n[GET /api/work/settings] status=${s.status}  body=${s.text.slice(0,120)}`)
line(`  => ${ok(s.status === 200)}: non-working user can READ work settings (expected 403)`)

// 2) PUT settings (write) — change job profile despite not working
const put = await api('PUT', '/api/work/settings', { token: u.token, body: {
  jobName: 'GHOST JOB (should not exist)', position: 'Spy', employer: 'Nobody',
  payType: 'hourly', rate: 500, regime: 'standard', workplace: 'onsite',
  normHours: 160, fullRateRetained: true, extraVacationDays: 7,
} })
line(`\n[PUT /api/work/settings] status=${put.status}`)
const s2 = await api('GET', '/api/work/settings', { token: u.token })
line(`  readback jobName=${JSON.stringify(s2.json?.jobName)} rate=${s2.json?.rate}`)
line(`  => ${ok(put.status === 200 && s2.json?.jobName === 'GHOST JOB (should not exist)')}: non-working user WROTE+persisted work profile (expected 403)`)

// 3) Create a shift type (mutation)
const st = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: 'Ghost shift', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
line(`\n[POST /api/work/shift-types] status=${st.status} id=${st.json?.id}`)

// 4) Create a contact holding third-party PII
const c = await api('POST', '/api/work/contacts', { token: u.token, body: {
  groupName: 'x', fullName: 'Victim Person', phone: '+380991112233', email: 'v@x.com' } })
line(`[POST /api/work/contacts] status=${c.status} id=${c.json?.id}`)

// 5) Create a meeting — this materialises into the SHARED calendar (moduleCode=work)
const m = await api('POST', '/api/work/meetings', { token: u.token, body: {
  withWhom: 'Secret meeting', when: '2026-12-01T10:00:00', place: 'HQ' } })
line(`[POST /api/work/meetings] status=${m.status} id=${m.json?.id}`)

// 6) Create a process task with a deadline -> also leaks into shared calendar
const p = await api('POST', '/api/work/process', { token: u.token, body: {
  title: 'Ghost process task', status: 'doing', dueDate: '2026-12-15' } })
line(`[POST /api/work/process] status=${p.status} id=${p.json?.id}`)

// 7) Create an obligation
const o = await api('POST', '/api/work/obligations', { token: u.token, body: { title: 'Ghost duty' } })
line(`[POST /api/work/obligations] status=${o.status} id=${o.json?.id}`)

// 8) Create a leave
const lv = await api('POST', '/api/work/leaves', { token: u.token, body: {
  type: 'vacation', startDate: '2026-12-20', endDate: '2026-12-31' } })
line(`[POST /api/work/leaves] status=${lv.status} id=${lv.json?.id}`)

// 9) Confirm the meeting + process deadline actually appear in the SHARED calendar feed
const cal = await api('GET', '/api/tasks/period?from=2026-12-01&to=2026-12-31', { token: u.token })
line(`\n[GET /api/tasks/period] status=${cal.status}`)
let workItems = []
try {
  const arr = Array.isArray(cal.json) ? cal.json : (cal.json?.items || cal.json?.tasks || [])
  workItems = arr.filter(x => (x.moduleCode === 'work') || /Зустріч|Задача/.test(x.title || ''))
} catch {}
line(`  work-module items visible in shared calendar: ${workItems.length}`)
line(`  titles: ${JSON.stringify(workItems.map(x => x.title).slice(0,5))}`)

const allMut = [st,c,m,p,o,lv].every(r => r.status === 200)
line(`\n==== VERDICT ====`)
line(`${ok(s.status===200 && put.status===200 && allMut)}: isWorking:false account fully exercised /api/work/* (read + 6 mutations) with NO server-side gate. Expected: 403/redirect. §7.1 🔴`)
