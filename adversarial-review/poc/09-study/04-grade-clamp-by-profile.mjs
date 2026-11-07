// §8 (fixed, ПЛАН P2-10 + P0-2): grade scale is derived SERVER-SIDE from the profile, never from a
// client-sent StudentType, and non-students cannot store grades at all (study module is gated).
//  (a) studentType=none  -> /api/study/* is 403 (feature off): cannot create assignments/grades.
//  (b) studentType=pupil -> grade scale 0..12 (from profile), clamp applied server-side.
//  (c) studentType=student -> grade scale 0..100 (from profile).
// Code: RequireModuleAttribute (study => pupil|student) + StudyService.ClampGradeAsync (reads profile).
import { provision, api } from '../_lib/provision.mjs'

const tag = Math.random().toString(36).slice(2, 7)

// (a) non-student is gated out of the whole study module -> cannot store a grade at all
const none = await provision({ email: `adv.t09.nonegrade.${tag}@gmail.com`, gender: 'female', studentType: 'none', isWorking: false })
const aNone = await api('POST', '/api/study/assignments', { token: none.token, body: {
  subjectId: null, type: 'homework', description: 'grade probe', deadlineKind: 'tomorrow',
  dueDate: null, isDone: true, grade: 87.55 } })
console.log('(a) studentType=none POST assignment ->', aNone.status, '(expect 403: study module off; no grades for non-students)')
const partA = aNone.status === 403

// (b) pupil: scale 0..12 from profile (50 -> 12); 12 kept
const pupil = await provision({ email: `adv.t09.pupilgrade.${tag}@gmail.com`, gender: 'female', studentType: 'pupil', isWorking: false })
const a3 = await api('POST', '/api/study/assignments', { token: pupil.token, body: {
  subjectId: null, type: 'homework', description: 'pupil 50', deadlineKind: 'tomorrow',
  dueDate: null, isDone: true, grade: 50 } })
const g3 = (await api('GET', '/api/study/assignments', { token: pupil.token })).json?.find((x) => x.id === a3.json?.id)
console.log('(b) studentType=pupil, grade 50 -> stored', g3?.grade, '(0..12 scale from profile)')
const partB = Number(g3?.grade) === 12

// (c) student: scale 0..100 from profile (87.55 kept; 999 -> 100)
const student = await provision({ email: `adv.t09.studgrade.${tag}@gmail.com`, gender: 'female', studentType: 'student', isWorking: false })
const a1 = await api('POST', '/api/study/assignments', { token: student.token, body: {
  subjectId: null, type: 'homework', description: 'kept', deadlineKind: 'tomorrow', dueDate: null, isDone: true, grade: 87.55 } })
const g1 = (await api('GET', '/api/study/assignments', { token: student.token })).json?.find((x) => x.id === a1.json?.id)
const a2 = await api('POST', '/api/study/assignments', { token: student.token, body: {
  subjectId: null, type: 'homework', description: 'over', deadlineKind: 'tomorrow', dueDate: null, isDone: true, grade: 999 } })
const g2 = (await api('GET', '/api/study/assignments', { token: student.token })).json?.find((x) => x.id === a2.json?.id)
console.log('(c) studentType=student, grade 87.55 ->', g1?.grade, '; grade 999 ->', g2?.grade, '(0..100 scale from profile)')
const partC = Number(g1?.grade) === 87.55 && Number(g2?.grade) === 100

console.log('\n' + ((partA && partB && partC)
  ? 'REFUTED — grade scale comes from the server-side profile (never a client StudentType): none is gated ' +
    '(403, no grades), pupil clamps 0..12, student clamps 0..100. No client input selects the scale.'
  : 'CONFIRMED/partial — partA=' + partA + ' partB=' + partB + ' partC=' + partC +
    ' (none=' + aNone.status + ' g3=' + g3?.grade + ' g1=' + g1?.grade + ' g2=' + g2?.grade + ')'))
