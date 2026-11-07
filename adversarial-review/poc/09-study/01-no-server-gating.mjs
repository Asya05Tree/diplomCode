// §7.1 CRITICAL — StudyController has ONLY [Authorize]; it NEVER checks profile.studentType.
// A user with studentType:'none' (UI hides the whole tab and shows study.noStatus) can still
// drive the ENTIRE Study API directly and mutate data.
// Code: StudyController.cs:30 ([Authorize] only, no studentType gate).
import { provision, api } from '../_lib/provision.mjs'

const U = await provision({ email: 'adv.t09.none@gmail.com', gender: 'female', studentType: 'none', isWorking: false })
console.log('provisioned NON-student userId=', U.userId, '(studentType=none → UI shows study.noStatus)')

const results = {}

// settings
const st = await api('GET', '/api/study/settings', { token: U.token })
results['GET settings'] = st.status
const putSt = await api('PUT', '/api/study/settings', { token: U.token, body: {
  learningForm: 'regular', termType: 'semester', studyStart: '2026-09-01', studyEnd: '2026-12-31',
  semesterEnd: '2026-12-31', yearEnd: '2027-05-31', vacationStart: null, vacationEnd: null } })
results['PUT settings'] = putSt.status

// subject
const subj = await api('POST', '/api/study/subjects', { token: U.token, body: {
  name: 'NONGATED-SUBJECT', teacher: 'Prof X', color: null,
  lectureRoom: '101', lectureLink: null, seminarRoom: null, seminarLink: null } })
results['POST subjects'] = `${subj.status} id=${subj.json?.id}`

// assignment
const asg = await api('POST', '/api/study/assignments', { token: U.token, body: {
  subjectId: subj.json?.id ?? null, type: 'homework', description: 'nongated hw',
  deadlineKind: 'tomorrow', dueDate: null, isDone: false, grade: null } })
results['POST assignments'] = `${asg.status} id=${asg.json?.id}`

// bells
const bells = await api('PUT', '/api/study/bells', { token: U.token, body: {
  bells: [{ index: 1, startTime: '08:30:00', endTime: '09:15:00' }] } })
results['PUT bells'] = bells.status

// schedule entry (creates a recurrence rule in the shared calendar too)
const sched = await api('POST', '/api/study/schedule', { token: U.token, body: {
  entryKind: 'lesson', subjectId: subj.json?.id ?? null, name: 'nongated lesson', sessionKind: 'lecture',
  pairNumber: 1, form: 'regular', room: null, link: null,
  recurrence: { type: 'WeekCycle', timeOfDay: '08:30:00', startDate: '2026-09-01', endDate: '2026-12-31',
    cycleWeeks: 1, cycleAnchorDate: '2026-09-01', weekDaysPattern: '0:1', weekDayTimesPattern: null,
    intervalDays: null, monthDayMode: null, monthDays: null, monthDayTimesPattern: null } } })
results['POST schedule'] = `${sched.status} id=${sched.json?.id}`

// project (student-only feature per UI)
const proj = await api('POST', '/api/study/projects', { token: U.token, body: {
  kind: 'diploma', name: 'nongated diploma', curator: null, deadlineKind: 'date', dueDate: '2027-05-01' } })
results['POST projects'] = `${proj.status} id=${proj.json?.id}`

// confirm persistence by reading back
const gotSubs = await api('GET', '/api/study/subjects', { token: U.token })
const gotProj = await api('GET', '/api/study/projects', { token: U.token })

console.log('\n--- status codes ---')
for (const [k, v] of Object.entries(results)) console.log(`${k.padEnd(16)} -> ${v}`)
console.log('GET subjects     ->', gotSubs.status, 'count=', (gotSubs.json || []).length)
console.log('GET projects     ->', gotProj.status, 'count=', (gotProj.json || []).length)

const allOk = [st, putSt, subj, asg, bells, sched, proj].every((r) => r.status === 200)
const persisted = (gotSubs.json || []).some((s) => s.name === 'NONGATED-SUBJECT') &&
  (gotProj.json || []).some((p) => p.name === 'nongated diploma')

console.log('\n' + (allOk && persisted
  ? 'CONFIRMED — studentType=none account fully used the Study API. Expected: 403/redirect (feature gated). ' +
    'Observed: all mutations returned 200 and data persisted (subject + diploma readable). Client gating is cosmetic.'
  : 'REFUTED — some endpoint rejected the non-student (allOk=' + allOk + ', persisted=' + persisted + ')'))
