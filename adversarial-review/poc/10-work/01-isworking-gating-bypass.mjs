// §7.1 — модуль "Робота" гейтиться НА СЕРВЕРІ (P0-2): акаунт із isWorking:false не має доступу до
// /api/work/* (403), попри будь-який прямий виклик API.
// Примітка: використовуємо унікальний email-per-run — фіксований email давав хибний результат, бо
// provision на email_taken лише логіниться в наявний акаунт і НЕ скидає його профіль (накопичений стан).
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t10.gate.${tag}@gmail.com`, gender: 'female', studentType: null, isWorking: false })
line(`Provisioned NON-working account userId=${u.userId} isWorking=false`)

const prof = await api('GET', '/api/health-profile', { token: u.token })
line(`[health-profile] isWorking=${JSON.stringify(prof.json?.isWorking)}`)

const s = await api('GET', '/api/work/settings', { token: u.token })
const put = await api('PUT', '/api/work/settings', { token: u.token, body: {
  jobName: 'GHOST JOB', payType: 'hourly', rate: 500, regime: 'standard', workplace: 'onsite',
  normHours: 160, fullRateRetained: true, extraVacationDays: 7 } })
const st = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: 'Ghost shift', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
const c = await api('POST', '/api/work/contacts', { token: u.token, body: {
  fullName: 'Victim Person', phone: '+380991112233', email: 'v@x.com' } })
const m = await api('POST', '/api/work/meetings', { token: u.token, body: {
  withWhom: 'Secret meeting', when: '2026-12-01T10:00:00', place: 'HQ' } })
const o = await api('POST', '/api/work/obligations', { token: u.token, body: { title: 'Ghost duty' } })

line(`\n[GET settings]=${s.status} [PUT settings]=${put.status} [POST shift-types]=${st.status}`)
line(`[POST contacts]=${c.status} [POST meetings]=${m.status} [POST obligations]=${o.status}`)

const all = [s, put, st, c, m, o]
const refuted = all.every(r => r.status === 403)
line(`\n==== VERDICT ====`)
line(refuted
  ? 'REFUTED — усі /api/work/* повертають 403 для акаунта з isWorking:false. Модуль гейтиться на сервері ' +
    '([RequireModule("work")]), приховування вкладок у UI — лише косметика поверх цього.'
  : `CONFIRMED/partial — statuses=${JSON.stringify(all.map(r => r.status))} (очікувалось усюди 403)`)
