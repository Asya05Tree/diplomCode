// §7.2 / §7.3 CRITICAL — "Великі роботи" and assignment "types" are not tied to studentType.
// A pupil (school child) can create diploma/coursework/practice projects and student-only
// assignment types (exam/lab/practical) via the API; a student can create "homework".
// Code: StudyController.cs:33 AssignmentTypes (flat list), :36 ProjectKinds (flat list),
//       StudyService.AddProjectAsync / AddAssignmentAsync (no studentType check).
import { provision, api } from '../_lib/provision.mjs'

const pupil = await provision({ email: 'adv.t09.pupil@gmail.com', gender: 'female', studentType: 'pupil', isWorking: false })
console.log('pupil userId=', pupil.userId, '(UI: no "projects" tab, assignment type fixed to homework)')

// Pupil creates a student-only diploma project with a step.
const proj = await api('POST', '/api/study/projects', { token: pupil.token, body: {
  kind: 'coursework', name: 'PUPIL-COURSEWORK', curator: 'Dr Who', deadlineKind: 'date', dueDate: '2027-01-01' } })
let stepStatus = 'n/a'
if (proj.json?.id) {
  const step = await api('POST', `/api/study/projects/${proj.json.id}/steps`, { token: pupil.token, body: {
    name: 'chapter 1', startDate: null, endDate: null, isDone: false } })
  stepStatus = step.status
}

// Pupil creates student-only assignment types.
const typeResults = {}
for (const type of ['exam', 'lab', 'practical', 'homework']) {
  const r = await api('POST', '/api/study/assignments', { token: pupil.token, body: {
    subjectId: null, type, description: `pupil ${type}`, deadlineKind: 'tomorrow',
    dueDate: null, isDone: false, grade: null } })
  typeResults[type] = r.status
}

console.log('\nPOST projects {kind:coursework} ->', proj.status, 'id=', proj.json?.id)
console.log('POST step                        ->', stepStatus)
console.log('assignment types created by pupil:', JSON.stringify(typeResults))

const projOk = proj.status === 200
const typesOk = Object.values(typeResults).every((s) => s === 200)
console.log('\n' + (projOk && typesOk
  ? 'CONFIRMED — pupil created a student-only "coursework" project (+step) and exam/lab/practical ' +
    'assignment types. Expected: server rejects kinds/types inconsistent with studentType. ' +
    'Observed: all 200. Invariant "школяр ≠ студент" holds only in the UI.'
  : 'REFUTED — projOk=' + projOk + ' typesOk=' + typesOk))
