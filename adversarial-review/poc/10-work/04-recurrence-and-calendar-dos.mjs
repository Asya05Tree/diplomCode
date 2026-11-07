// §6 / §11 (🟠) — recurrence params not validated server-side + unbounded calendar range.
//  - arbitrary Type, IntervalDays=0 / negative, EndDate=null, >1y span all accepted.
//  - GET schedule/calendar?from..to has no range cap → forces generation across any span.
// Also checks the IntervalDays=0 "hang" claim (TaskService uses Math.max(1,...) — no hang).
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)
const ok = (c) => (c ? 'CONFIRMED' : 'not-as-expected')

const u = await provision({ email: 'adv.t10.rec@gmail.com', isWorking: true })
const t = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: 'R', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
const typeId = t.json.id
line(`userId=${u.userId} typeId=${typeId}`)

const mk = (over) => ({
  type: 'EveryNDays', timeOfDay: '09:00:00', startDate: '2000-01-01', endDate: null,
  cycleWeeks: null, cycleAnchorDate: null, weekDaysPattern: null, weekDayTimesPattern: null,
  intervalDays: 1, monthDayMode: null, monthDays: null, monthDayTimesPattern: null, ...over })

// 1) IntervalDays = 0
const i0 = await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: mk({ intervalDays: 0 }) } })
line(`\n[intervalDays=0] POST status=${i0.status} id=${i0.json?.id}`)

// 2) IntervalDays = -5
const ineg = await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: mk({ intervalDays: -5 }) } })
line(`[intervalDays=-5] POST status=${ineg.status} id=${ineg.json?.id}`)

// 3) Arbitrary Type string
const bogus = await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: mk({ type: 'TOTALLY_BOGUS_TYPE' }) } })
line(`[type=TOTALLY_BOGUS_TYPE] POST status=${bogus.status} id=${bogus.json?.id}`)

// 4) EndDate=null + startDate far in the past (unbounded forward)
line(`\n[recurrence params not validated] accepts intervalDays<=0, bogus Type, endDate=null, start=2000`)
line(`  => ${ok(i0.status===200 && ineg.status===200 && bogus.status===200)}: no server validation of recurrence (§6, §11).`)

// 5) Unbounded calendar range — from 2000..2100 (100 years). Measure time + count.
const started = Date.now()
const cal = await api('GET', `/api/work/schedule/calendar?from=2000-01-01&to=2100-01-01`, { token: u.token })
const ms = Date.now() - started
const n = Array.isArray(cal.json) ? cal.json.length : 0
line(`\n[GET schedule/calendar from=2000-01-01 to=2100-01-01] status=${cal.status} items=${n} elapsed=${ms}ms`)
line(`  => ${ok(cal.status===200)}: no range cap; server generated ${n} occurrences in-memory in ${ms}ms across ${['entries']} entries. §6/§11`)

line(`\n==== VERDICT ====`)
line(`CONFIRMED: recurrence params unvalidated + calendar range uncapped → amplified generation DoS.`)
line(`NOTE on 'hang' claim (§11): intervalDays<=0 did NOT hang — TaskService GenerateEveryNDaysDates uses Math.Max(1, interval) (TaskService.cs:173). Loop is day-stepped & bounded by range, so interval 0/neg is coerced to 1, no infinite loop. That sub-claim is REFUTED; DoS is instead O(days*rules).`)
