// §6/§10 MEDIUM — assorted missing validation on the Study API.
//  (8a) sessionKind / Form are free strings (not in {lecture,seminar} / {distance,regular,mixed}).
//  (8b) deadlineKind="date" with dueDate=null → ResolveDeadline returns null (task "without deadline"
//       despite kind "До дати"); client sends it when no date picked.
//  (8c) settings accept studyStart > studyEnd (no date-order check).
// Code: StudyService.AddScheduleEntryAsync (sessionKind/form stored raw), ResolveDeadline:236,
//       UpdateSettingsAsync:82-89 (no order check).
import { provision, api } from '../_lib/provision.mjs'

const U = await provision({ email: 'adv.t09.misc@gmail.com', gender: 'female', studentType: 'student', isWorking: false })

// (8a) arbitrary sessionKind + Form
const s = await api('POST', '/api/study/schedule', { token: U.token, body: {
  entryKind: 'lesson', subjectId: null, name: 'junk', sessionKind: '<<<not-a-kind>>>', pairNumber: 1,
  form: 'TOTALLY_INVALID_FORM', room: null, link: null,
  recurrence: { type: 'WeekCycle', timeOfDay: '08:30:00', startDate: '2026-09-01', endDate: '2026-12-31',
    cycleWeeks: 1, cycleAnchorDate: '2026-09-01', weekDaysPattern: '0:1', weekDayTimesPattern: null,
    intervalDays: null, monthDayMode: null, monthDays: null, monthDayTimesPattern: null } } })
const got = (await api('GET', '/api/study/schedule', { token: U.token })).json?.find((x) => x.id === s.json?.id)
console.log('(8a) POST schedule sessionKind="<<<not-a-kind>>>" form="TOTALLY_INVALID_FORM" ->', s.status,
  '| stored form=', JSON.stringify(got?.form))
const a8 = s.status === 200

// (8b) deadlineKind="date" but dueDate=null
const asg = await api('POST', '/api/study/assignments', { token: U.token, body: {
  subjectId: null, type: 'homework', description: 'date-but-no-date', deadlineKind: 'date',
  dueDate: null, isDone: false, grade: null } })
const g = (await api('GET', '/api/study/assignments', { token: U.token })).json?.find((x) => x.id === asg.json?.id)
console.log('(8b) POST assignment deadlineKind="date", dueDate=null ->', asg.status,
  '| resolvedDeadline=', JSON.stringify(g?.resolvedDeadline), '(null = never a debt)')
const b8 = asg.status === 200 && g?.resolvedDeadline == null

// (8c) studyStart > studyEnd
const st = await api('PUT', '/api/study/settings', { token: U.token, body: {
  learningForm: 'regular', termType: 'semester', studyStart: '2099-01-01', studyEnd: '1990-01-01',
  semesterEnd: '1990-01-01', yearEnd: '1990-01-01', vacationStart: null, vacationEnd: null } })
const back = (await api('GET', '/api/study/settings', { token: U.token })).json
console.log('(8c) PUT settings studyStart=2099 > studyEnd=1990 ->', st.status,
  '| stored start=', back?.studyStart, 'end=', back?.studyEnd)
const c8 = st.status === 200 && back?.studyStart === '2099-01-01' && back?.studyEnd === '1990-01-01'

console.log('\n' + ((a8 && b8 && c8)
  ? 'CONFIRMED — (8a) arbitrary sessionKind/Form stored; (8b) date-kind with null dueDate → null ' +
    'deadline (never overdue); (8c) inverted study dates accepted. Expected: enum/consistency/order ' +
    'checks + 400. Observed: all 200.'
  : 'PARTIAL/REFUTED — a8=' + a8 + ' b8=' + b8 + ' c8=' + c8))
