// §6 / §11 — параметри повторення тепер валідуються НА СЕРВЕРІ, а діапазон календаря обмежений роком.
//  - невідомий Type -> 400 invalid_recurrence_type
//  - EveryNDays з intervalDays<=0 (або >366) -> 400 invalid_interval
//  - валідний EveryNDays (intervalDays=1) -> 200
//  - GET schedule/calendar на 100 років -> 400 invalid_range (межа 366 днів, уже була раніше)
// FIXED (залишок 10-work/04): TaskService.ValidateRecurrence у CreateRecurrenceRuleAsync/UpdateRecurrenceRuleAsync.
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t10.rec.${tag}@gmail.com`, isWorking: true })
const t = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: 'R', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
const typeId = t.json.id
line(`userId=${u.userId} typeId=${typeId}`)

const mk = (over) => ({
  type: 'EveryNDays', timeOfDay: '09:00:00', startDate: '2026-01-01', endDate: '2026-12-31',
  cycleWeeks: null, cycleAnchorDate: null, weekDaysPattern: null, weekDayTimesPattern: null,
  intervalDays: 1, monthDayMode: null, monthDays: null, monthDayTimesPattern: null, ...over })

const i0 = await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: mk({ intervalDays: 0 }) } })
const ineg = await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: mk({ intervalDays: -5 }) } })
const bogus = await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: mk({ type: 'TOTALLY_BOGUS_TYPE' }) } })
const okRec = await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: mk({ intervalDays: 1 }) } })
line(`\n[intervalDays=0] ${i0.status} ${i0.json?.error ?? ''}`)
line(`[intervalDays=-5] ${ineg.status} ${ineg.json?.error ?? ''}`)
line(`[type=TOTALLY_BOGUS_TYPE] ${bogus.status} ${bogus.json?.error ?? ''}`)
line(`[valid EveryNDays interval=1] ${okRec.status} (expect 200)`)

const cal = await api('GET', `/api/work/schedule/calendar?from=2000-01-01&to=2100-01-01`, { token: u.token })
line(`\n[GET schedule/calendar from=2000 to=2100] ${cal.status} ${cal.json?.error ?? ''} (expect 400 invalid_range)`)

const refuted =
  i0.status === 400 && i0.json?.error === 'invalid_interval' &&
  ineg.status === 400 && ineg.json?.error === 'invalid_interval' &&
  bogus.status === 400 && bogus.json?.error === 'invalid_recurrence_type' &&
  okRec.status === 200 &&
  cal.status === 400 && cal.json?.error === 'invalid_range'

line(`\n==== VERDICT ====`)
line(refuted
  ? 'REFUTED — невідомий тип і інтервал ≤0 відхиляються (400), валідне правило проходить (200), ' +
    'а 100-річний діапазон календаря обмежено (400 invalid_range). Ампліфікованого розгортання немає.'
  : `CONFIRMED/partial — i0=${i0.status} ineg=${ineg.status} bogus=${bogus.status} ok=${okRec.status} cal=${cal.status}`)
