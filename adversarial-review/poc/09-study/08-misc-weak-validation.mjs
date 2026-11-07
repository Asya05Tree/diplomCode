// §6/§10 MEDIUM — assorted missing validation on the Study API.
//  (8a) sessionKind / Form are free strings (not in {lecture,seminar} / {distance,regular,mixed}).
//  (8b) deadlineKind="date" with dueDate=null → ResolveDeadline returns null (task "without deadline"
//       despite kind "До дати"); client sends it when no date picked.
//  (8c) settings accept studyStart > studyEnd (no date-order check).
// Code: StudyService.AddScheduleEntryAsync (sessionKind/form stored raw), ResolveDeadline:236,
//       UpdateSettingsAsync:82-89 (no order check).
import { provision, api } from '../_lib/provision.mjs'

const tag = Math.random().toString(36).slice(2, 7)
const U = await provision({ email: `adv.t09.misc.${tag}@gmail.com`, gender: 'female', studentType: 'student', isWorking: false })

// (8a, fixed P2-10) arbitrary sessionKind + Form -> dropped to null (not stored verbatim)
const s = await api('POST', '/api/study/schedule', { token: U.token, body: {
  entryKind: 'lesson', subjectId: null, name: 'junk', sessionKind: '<<<not-a-kind>>>', pairNumber: 1,
  form: 'TOTALLY_INVALID_FORM', room: null, link: null,
  recurrence: { type: 'WeekCycle', timeOfDay: '08:30:00', startDate: '2026-09-01', endDate: '2026-12-31',
    cycleWeeks: 1, cycleAnchorDate: '2026-09-01', weekDaysPattern: '0:1', weekDayTimesPattern: null,
    intervalDays: null, monthDayMode: null, monthDays: null, monthDayTimesPattern: null } } })
const got = (await api('GET', '/api/study/schedule', { token: U.token })).json?.find((x) => x.id === s.json?.id)
console.log('(8a) POST schedule garbage sessionKind/form ->', s.status,
  '| stored sessionKind=', JSON.stringify(got?.sessionKind), 'form=', JSON.stringify(got?.form))
const a8refuted = s.status === 200 && got?.sessionKind == null && got?.form == null

// (8c, fixed P2-10) studyStart > studyEnd -> 400, nothing stored inverted
const st = await api('PUT', '/api/study/settings', { token: U.token, body: {
  learningForm: 'regular', termType: 'semester', studyStart: '2099-01-01', studyEnd: '1990-01-01',
  semesterEnd: '1990-01-01', yearEnd: '1990-01-01', vacationStart: null, vacationEnd: null } })
console.log('(8c) PUT settings studyStart=2099 > studyEnd=1990 ->', st.status, st.text?.slice(0, 50))
const c8refuted = st.status === 400

// (8b) RESIDUAL (не P2-10): deadlineKind="date" but dueDate=null -> treated as no deadline
const asg = await api('POST', '/api/study/assignments', { token: U.token, body: {
  subjectId: null, type: 'homework', description: 'date-but-no-date', deadlineKind: 'date',
  dueDate: null, isDone: false, grade: null } })
const g = (await api('GET', '/api/study/assignments', { token: U.token })).json?.find((x) => x.id === asg.json?.id)
console.log('(8b) RESIDUAL deadlineKind="date", dueDate=null ->', asg.status,
  '| resolvedDeadline=', JSON.stringify(g?.resolvedDeadline), '(null = never a debt; minor UX, P3)')

console.log('\n' + ((a8refuted && c8refuted)
  ? 'REFUTED (P2-10 scope): (8a) garbage sessionKind/form dropped to null; (8c) inverted study dates -> 400. ' +
    '(8b) date-kind-with-null-dueDate is a known minor UX residual (candidate P3).'
  : 'PARTIAL/CONFIRMED — a8refuted=' + a8refuted + ' c8refuted=' + c8refuted))
