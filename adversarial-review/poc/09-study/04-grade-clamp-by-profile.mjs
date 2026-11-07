// §8 CRITICAL — Grade clamp is keyed on profile.StudentType, not on task context.
//  (a) studentType=none ("nobody", feature hidden in UI) still gets the 0..100 scale.
//  (b) Switching a pupil's grade later re-clamps a previously stored 0..100 grade down to 0..12
//      on the NEXT update — silent data loss.
// Code: StudyService.ClampGradeAsync:217-224.
import { provision, api } from '../_lib/provision.mjs'

// (a) non-student gets 0..100
const none = await provision({ email: 'adv.t09.nonegrade@gmail.com', gender: 'female', studentType: 'none', isWorking: false })
const a1 = await api('POST', '/api/study/assignments', { token: none.token, body: {
  subjectId: null, type: 'homework', description: 'grade probe', deadlineKind: 'tomorrow',
  dueDate: null, isDone: true, grade: 87.55 } })
const g1 = (await api('GET', '/api/study/assignments', { token: none.token })).json?.find((x) => x.id === a1.json?.id)
console.log('(a) studentType=none, grade 87.55 ->', g1?.grade, '(0..100 scale applied to a non-student)')

// also prove >100 clamps to 100 (0..100 branch), proving it is NOT the 0..12 branch
const a2 = await api('POST', '/api/study/assignments', { token: none.token, body: {
  subjectId: null, type: 'homework', description: 'over', deadlineKind: 'tomorrow',
  dueDate: null, isDone: true, grade: 999 } })
const g2 = (await api('GET', '/api/study/assignments', { token: none.token })).json?.find((x) => x.id === a2.json?.id)
console.log('    grade 999 -> clamped to', g2?.grade, '(==100 confirms 0..100 branch, not 0..12)')

const partA = Number(g1?.grade) === 87.55 && Number(g2?.grade) === 100

// (b) pupil stored a 0..12 grade; grade 12 ok, but 50 collapses to 12 (silent)
const pupil = await provision({ email: 'adv.t09.pupilgrade@gmail.com', gender: 'female', studentType: 'pupil', isWorking: false })
const a3 = await api('POST', '/api/study/assignments', { token: pupil.token, body: {
  subjectId: null, type: 'homework', description: 'pupil 50', deadlineKind: 'tomorrow',
  dueDate: null, isDone: true, grade: 50 } })
const g3 = (await api('GET', '/api/study/assignments', { token: pupil.token })).json?.find((x) => x.id === a3.json?.id)
console.log('(b) studentType=pupil, grade 50 -> stored', g3?.grade, '(clamped to 0..12; value silently lost)')

const partB = Number(g3?.grade) === 12
console.log('\n' + (partA && partB
  ? 'CONFIRMED — grade scale follows profile.StudentType. none→0..100 (87.55 kept, 999→100); ' +
    'pupil→0..12 (50→12). Expected: scale from the assignment context; non-students should not ' +
    'be able to store grades at all. Observed: silent 0..100 for "nobody" and silent clamp for pupil.'
  : 'REFUTED — partA=' + partA + ' partB=' + partB + ' (g1=' + g1?.grade + ' g2=' + g2?.grade + ' g3=' + g3?.grade + ')'))
