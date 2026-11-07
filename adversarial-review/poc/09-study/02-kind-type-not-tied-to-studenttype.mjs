// §7.2 / §7.3 — "Великі роботи" та типи завдань тепер привʼязані до studentType НА СЕРВЕРІ.
// Школяр: лише homework, без великих робіт, факультатив дозволено. Студент: lab/exam/practical,
// великі роботи дозволено, homework/факультатив — ні.
// FIXED (залишок 09-study/02): StudyService.AddAssignmentAsync/UpdateAssignmentAsync гейтять тип за
// профілем (invalid_type_for_profile); AddProjectAsync у школяра → projects_student_only;
// AddScheduleEntryAsync з elective у студента → elective_pupil_only.
import { provision, api } from '../_lib/provision.mjs'

const tag = Math.random().toString(36).slice(2, 7)
const pupil = await provision({ email: `adv.t09.pupilkind.${tag}@gmail.com`, gender: 'female', studentType: 'pupil', isWorking: false })
const student = await provision({ email: `adv.t09.studkind.${tag}@gmail.com`, gender: 'male', studentType: 'student', isWorking: false })

// 1) Школяр намагається створити студентську велику роботу → 400 projects_student_only
const proj = await api('POST', '/api/study/projects', { token: pupil.token, body: {
  kind: 'coursework', name: 'PUPIL-COURSEWORK', curator: 'Dr Who', deadlineKind: 'date', dueDate: '2027-01-01' } })
console.log('pupil POST projects {coursework} ->', proj.status, proj.json?.error ?? '')

// 2) Школяр намагається створити студентські типи завдань; homework має пройти
const pupilTypes = {}
for (const type of ['exam', 'lab', 'practical', 'homework']) {
  const r = await api('POST', '/api/study/assignments', { token: pupil.token, body: {
    subjectId: null, type, description: `pupil ${type}`, deadlineKind: 'tomorrow', dueDate: null, isDone: false, grade: null } })
  pupilTypes[type] = r.status
}
console.log('pupil assignment types:', JSON.stringify(pupilTypes), '(expect exam/lab/practical=400, homework=200)')

// 3) Студент: homework заборонено, lab дозволено
const sHw = await api('POST', '/api/study/assignments', { token: student.token, body: {
  subjectId: null, type: 'homework', description: 'student hw', deadlineKind: 'tomorrow', dueDate: null, isDone: false, grade: null } })
const sLab = await api('POST', '/api/study/assignments', { token: student.token, body: {
  subjectId: null, type: 'lab', description: 'student lab', deadlineKind: 'tomorrow', dueDate: null, isDone: false, grade: null } })
console.log('student homework ->', sHw.status, '; student lab ->', sLab.status, '(expect 400, 200)')

// 4) Студент намагається створити факультатив (лише для школяра) → 400 elective_pupil_only
const elect = await api('POST', '/api/study/schedule', { token: student.token, body: {
  entryKind: 'elective', subjectId: null, name: 'student elective', sessionKind: null, pairNumber: null,
  form: null, room: null, link: null, recurrence: {
    type: 'EveryNDays', timeOfDay: '09:00:00', startDate: '2026-12-01', endDate: '2026-12-31',
    cycleWeeks: null, cycleAnchorDate: null, weekDaysPattern: null, weekDayTimesPattern: null,
    intervalDays: 1, monthDayMode: null, monthDays: null, monthDayTimesPattern: null } } })
console.log('student POST schedule {elective} ->', elect.status, elect.json?.error ?? '')

const refuted =
  proj.status === 400 && proj.json?.error === 'projects_student_only' &&
  pupilTypes.exam === 400 && pupilTypes.lab === 400 && pupilTypes.practical === 400 && pupilTypes.homework === 200 &&
  sHw.status === 400 && sLab.status === 200 &&
  elect.status === 400 && elect.json?.error === 'elective_pupil_only'

console.log('\n' + (refuted
  ? 'REFUTED — школяр ≠ студент тепер тримається на сервері: школяр не створює великих робіт і студентських ' +
    'типів завдань (лише homework), студент не створює homework/факультативів. Інваріант не залежить від UI.'
  : 'CONFIRMED/partial — proj=' + proj.status + ' pupil=' + JSON.stringify(pupilTypes) +
    ' sHw=' + sHw.status + ' sLab=' + sLab.status + ' elect=' + elect.status))
