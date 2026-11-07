// §6 HIGH — No server-side max-length on any string. Client maxLength=300 on description is
// bypassed with a direct API call → arbitrary-size blobs stored (storage DoS, bloated responses,
// broken layout). Only .Trim() is applied.
// Code: StudyService.AddAssignmentAsync:180 (description.Trim()), AddSubjectAsync:114-120 (Trim only).
import { provision, api } from '../_lib/provision.mjs'

const U = await provision({ email: 'adv.t09.bigstr@gmail.com', gender: 'female', studentType: 'student', isWorking: false })

const bigDesc = 'A'.repeat(200000)   // 200 KB description (client cap is 300 chars)
const bigName = 'B'.repeat(100000)   // 100 KB subject name

const asg = await api('POST', '/api/study/assignments', { token: U.token, body: {
  subjectId: null, type: 'homework', description: bigDesc, deadlineKind: 'tomorrow',
  dueDate: null, isDone: false, grade: null } })
const sub = await api('POST', '/api/study/subjects', { token: U.token, body: {
  name: bigName, teacher: 'C'.repeat(50000), color: null,
  lectureRoom: null, lectureLink: null, seminarRoom: null, seminarLink: null } })

const gotA = (await api('GET', '/api/study/assignments', { token: U.token })).json?.find((x) => x.id === asg.json?.id)
const gotS = (await api('GET', '/api/study/subjects', { token: U.token })).json?.find((x) => x.id === sub.json?.id)

console.log('POST assignment 200KB desc ->', asg.status, 'stored length=', gotA?.description?.length)
console.log('POST subject    100KB name ->', sub.status, 'stored name length=', gotS?.name?.length,
  'teacher length=', gotS?.teacher?.length)

const confirmed = asg.status === 200 && gotA?.description?.length === 200000 &&
  sub.status === 200 && gotS?.name?.length === 100000
console.log('\n' + (confirmed
  ? 'CONFIRMED — 200KB description + 100KB name/50KB teacher stored and returned verbatim. ' +
    'Expected: server length caps (e.g. desc<=300, names<=200). Observed: no cap; storage/response DoS.'
  : 'REFUTED — lengths not preserved (asg=' + asg.status + ' descLen=' + gotA?.description?.length + ')'))
