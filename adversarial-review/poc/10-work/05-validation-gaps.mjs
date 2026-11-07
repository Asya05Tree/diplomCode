// §6 / §8 / §10 — server-side validation. P2-10 закриває СТЕЛЮ СУМ (rate / onCallMultiplier) і разом
// перевіряє, що length (P2-2) та color вже не проходять. Формат телефону/email та абсурдні дати
// зустрічі — свідомо поза P2-10 (нит якості/формат, React екранує), позначені RESIDUAL.
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t10.val.${tag}@gmail.com`, isWorking: true })
line(`userId=${u.userId}`)

// 1) Huge strings (10k) — [StringLength] на DTO (P2-2) має дати 400, а не зберегти
const big = 'Z'.repeat(10000)
const bigJob = await api('PUT', '/api/work/settings', { token: u.token, body: {
  jobName: big, payType: 'hourly', regime: 'standard', workplace: 'onsite', fullRateRetained: false } })
const bigType = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: big, color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
const lengthRefuted = bigJob.status === 400 && bigType.status === 400
line(`\n[length] PUT 10k jobName=${bigJob.status}; POST 10k shift-type name=${bigType.status}  => ${lengthRefuted ? 'REFUTED (400, P2-2)' : 'CONFIRMED'}`)

// 2) Color garbage — надто довге (>32) відсікається [StringLength(Color)] (P2-2)
const badColor = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: 'badcolor', color: 'red; } body{display:none} .x{color:', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
const types = await api('GET', '/api/work/shift-types', { token: u.token })
const storedColor = (types.json||[]).find(t => t.name==='badcolor')?.color
const colorRefuted = badColor.status === 400 || !(storedColor && storedColor.includes('display:none'))
line(`[color] POST CSS-garbage color status=${badColor.status}; stored="${storedColor}"  => ${colorRefuted ? 'REFUTED (length-capped)' : 'CONFIRMED'}`)

// 3) Income ceiling (P2-10): multiplier 1e9 (oncall) + rate 1e9 -> 400
const oncall = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name:'rich', color:'#ffd59e', startTime:'00:00:00', endTime:'00:00:00', kind:'oncall', onCallMultiplier: 1000000000 } })
const rateBig = await api('PUT', '/api/work/settings', { token: u.token, body: {
  jobName:'J', payType:'hourly', rate: 1000000000, regime:'standard', workplace:'onsite', fullRateRetained:false } })
line(`\n[income ceiling] oncall multiplier 1e9 POST=${oncall.status} ${oncall.text?.slice(0,40)}; rate 1e9 PUT=${rateBig.status} ${rateBig.text?.slice(0,40)}`)
const incomeRefuted = oncall.status === 400 && rateBig.status === 400
// контроль: розумні значення проходять (не над-блокуємо)
const oncallOk = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name:'sane-oncall', color:'#ffd59e', startTime:'00:00:00', endTime:'08:00:00', kind:'oncall', onCallMultiplier: 1.5 } })
const rateOk = await api('PUT', '/api/work/settings', { token: u.token, body: {
  jobName:'J', payType:'hourly', rate: 500, regime:'standard', workplace:'onsite', fullRateRetained:false } })
line(`  control: multiplier 1.5 POST=${oncallOk.status}; rate 500 PUT=${rateOk.status} (expect 200/200)`)
line(`  => ${incomeRefuted && oncallOk.status===200 && rateOk.status===200 ? 'REFUTED: rate & multiplier capped (1e9 -> 400, sane -> 200)' : 'CONFIRMED'} (§10, P2-10).`)

// 4) Формат email контакту + діапазон дати зустрічі — тепер валідуються на сервері (залишок 10-work/05)
const badEmail = await api('POST', '/api/work/contacts', { token: u.token, body: {
  fullName:'Garbage', phone:'+380991112233', email:'@@@not-an-email', telegram:'tg' } })
const okEmail = await api('POST', '/api/work/contacts', { token: u.token, body: {
  fullName:'Valid Person', phone:'+380991112234', email:'name@mail.com', telegram:'tg' } })
const mFar = await api('POST', '/api/work/meetings', { token: u.token, body: { withWhom:'future', when:'9999-12-31T23:59:00' } })
const mOk = await api('POST', '/api/work/meetings', { token: u.token, body: { withWhom:'soon', when:'2026-12-20T10:00:00' } })
line(`\n[contact email] garbage=${badEmail.status} ${badEmail.json?.error ?? ''}; valid=${okEmail.status} (expect 400/200)`)
line(`[meeting date] 9999=${mFar.status} ${mFar.json?.error ?? ''}; 2026=${mOk.status} (expect 400/200)`)
const formatRefuted = badEmail.status === 400 && badEmail.json?.error === 'invalid_email' && okEmail.status === 200 &&
  mFar.status === 400 && mFar.json?.error === 'invalid_meeting_date' && mOk.status === 200

line(`\n==== VERDICT ====`)
line((lengthRefuted && colorRefuted && incomeRefuted && formatRefuted)
  ? `REFUTED: income ceiling (rate/multiplier), length & color capped, email format + meeting date range enforced server-side.`
  : `CONFIRMED/partial: length=${lengthRefuted} color=${colorRefuted} income=${incomeRefuted} format=${formatRefuted}.`)
