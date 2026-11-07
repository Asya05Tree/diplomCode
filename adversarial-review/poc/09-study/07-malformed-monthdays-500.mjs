// §6 / §11 HIGH — Recurrence patterns are not validated. A schedule entry with
// MonthDayMode="Specific" and a malformed MonthDays string flows straight into
// GenerateMonthDaysDates → `.Select(int.Parse)` → FormatException → 500 on ANY calendar read
// (not just Study — the main planner /api/tasks/period crashes too).
// Code: StudyController.AddSchedule:145 (only checks EntryKinds + Recurrence!=null),
//       TaskService.GenerateMonthDaysDates:133 (int.Parse, no try).
import { provision, api } from '../_lib/provision.mjs'

const U = await provision({ email: 'adv.t09.monthdays@gmail.com', gender: 'female', studentType: 'student', isWorking: false })

const add = await api('POST', '/api/study/schedule', { token: U.token, body: {
  entryKind: 'lesson', subjectId: null, name: 'poison', sessionKind: 'lecture',
  pairNumber: 1, form: 'regular', room: null, link: null,
  recurrence: {
    type: 'MonthDays', timeOfDay: '08:30:00', startDate: '2026-01-01', endDate: '2026-12-31',
    cycleWeeks: null, cycleAnchorDate: null, weekDaysPattern: null, weekDayTimesPattern: null,
    intervalDays: null, monthDayMode: 'Specific', monthDays: 'abc,99,xyz', monthDayTimesPattern: null } } })
console.log('POST schedule (MonthDays="abc,99,xyz") ->', add.status, 'id=', add.json?.id)

// Now read the MAIN calendar for a range covering the rule.
const period = await api('GET', '/api/tasks/period?from=2026-01-01&to=2026-02-01', { token: U.token })
const day = await api('GET', '/api/tasks/day?date=2026-01-15', { token: U.token })
const sched = await api('GET', '/api/study/schedule', { token: U.token })
console.log('GET /api/tasks/period ->', period.status)
console.log('GET /api/tasks/day    ->', day.status)
console.log('GET /api/study/schedule ->', sched.status)
console.log('period body (first 160):', (period.text || '').slice(0, 160))

const confirmed = add.status === 200 && (period.status >= 500 || day.status >= 500 || sched.status >= 500)
console.log('\n' + (confirmed
  ? 'CONFIRMED — malformed MonthDays accepted (200) then crashes calendar generation (period=' +
    period.status + ' day=' + day.status + ' schedule=' + sched.status + '). Expected: 400 on bad ' +
    'pattern. Observed: 500 self-DoS of the shared planner, not just Study.'
  : 'REFUTED — no 500 (add=' + add.status + ' period=' + period.status + ' day=' + day.status + ' sched=' + sched.status + ')'))
