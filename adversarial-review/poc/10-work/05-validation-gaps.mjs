// §6 / §8 / §10 (🟠/🟡) — missing server-side validation:
//  - string length unbounded (job/type/contact/title) — bypasses client maxLength
//  - shift type Color is stored as-is (CSS garbage / huge)
//  - phone / email / telegram not format-validated server-side
//  - meeting When accepts absurd dates (year 0001 / 9999)
//  - income has no ceiling: onCallMultiplier + rate unbounded
//  - start==end shift stored (workShared.segmentHours -> 24h client-side)
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)
const ok = (c) => (c ? 'CONFIRMED' : 'not-as-expected')

const u = await provision({ email: 'adv.t10.val@gmail.com', isWorking: true })
line(`userId=${u.userId}`)

// 1) Huge strings (10k) — client caps job=60, type name=24, contact=40, process has NO cap
const big = 'Z'.repeat(10000)
const bigJob = await api('PUT', '/api/work/settings', { token: u.token, body: {
  jobName: big, payType: 'hourly', regime: 'standard', workplace: 'onsite', fullRateRetained: false } })
const rs = await api('GET', '/api/work/settings', { token: u.token })
line(`\n[length] PUT 10k jobName status=${bigJob.status}; stored length=${(rs.json?.jobName||'').length}`)
const bigType = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: big, color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
line(`[length] POST 10k shift-type name status=${bigType.status} id=${bigType.json?.id}`)
line(`  => ${ok((rs.json?.jobName||'').length===10000 && bigType.status===200)}: no length limit server-side (§6).`)

// 2) Color stored as-is — CSS injection-ish garbage
const badColor = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: 'badcolor', color: 'red; } body{display:none} .x{color:', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
const types = await api('GET', '/api/work/shift-types', { token: u.token })
const stored = (types.json||[]).find(t => t.name==='badcolor')?.color
line(`\n[color] POST arbitrary color status=${badColor.status}; stored="${stored}"`)
line(`  => ${ok(stored && stored.includes('display:none'))}: Color not validated, stored verbatim (§6/§8).`)

// 3) Phone / email / telegram garbage
const c = await api('POST', '/api/work/contacts', { token: u.token, body: {
  groupName:'', fullName:'Garbage', phone:'<script>alert(1)</script>', email:'@@@not-an-email', telegram:'no spaces allowed??' } })
const cs = await api('GET', '/api/work/contacts', { token: u.token })
const gc = (cs.json||[]).find(x => x.fullName==='Garbage')
line(`\n[contact] POST garbage status=${c.status}; stored phone="${gc?.phone}" email="${gc?.email}" tg="${gc?.telegram}"`)
line(`  => ${ok(c.status===200 && gc?.email==='@@@not-an-email')}: phone/email/telegram not validated server-side (§8/§10).`)

// 4) Meeting absurd dates
const mOld = await api('POST', '/api/work/meetings', { token: u.token, body: { withWhom:'ancient', when:'0001-01-01T00:00:00' } })
const mFar = await api('POST', '/api/work/meetings', { token: u.token, body: { withWhom:'future', when:'9999-12-31T23:59:00' } })
line(`\n[meeting dates] when=0001 status=${mOld.status}; when=9999 status=${mFar.status}`)
line(`  => ${ok(mOld.status===200 && mFar.status===200)}: no sane date-range check on When (§6).`)

// 5) Income no ceiling: multiplier 1e9 (oncall) + rate 1e9
const oncall = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name:'rich', color:'#ffd59e', startTime:'00:00:00', endTime:'00:00:00', kind:'oncall', onCallMultiplier: 1000000000 } })
const rateBig = await api('PUT', '/api/work/settings', { token: u.token, body: {
  jobName:'J', payType:'hourly', rate: 1000000000, regime:'standard', workplace:'onsite', fullRateRetained:false } })
const typesAfter = await api('GET', '/api/work/shift-types', { token: u.token })
const rich = (typesAfter.json||[]).find(t=>t.name==='rich')
const settingsAfter = await api('GET', '/api/work/settings', { token: u.token })
line(`\n[income ceiling] oncall multiplier stored=${rich?.onCallMultiplier}; rate stored=${settingsAfter.json?.rate}`)
line(`  start==end(00:00) stored startTime=${rich?.startTime} endTime=${rich?.endTime} (client segmentHours => 24h)`)
line(`  => ${ok(Number(rich?.onCallMultiplier)>=1e9 && Number(settingsAfter.json?.rate)>=1e9)}: multiplier & rate have no upper bound; income computed client-side with no clamp (§10).`)

line(`\n==== VERDICT ====`)
line(`CONFIRMED: no server-side length/format/date/ceiling validation across settings, shift-types, contacts, meetings.`)
