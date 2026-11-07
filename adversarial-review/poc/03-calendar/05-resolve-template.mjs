// §7 — ResolveTaskAsync does NOT filter RecurrenceRuleId==null (unlike Update/Delete which do).
// Owner can POST resolve on the rule's TEMPLATE task id; Skipped/Postpone nulls the template's
// StartDateTime and sets Status=Unassigned → corrupts the rule-template invariant.
// Code: TaskService.cs:416 (no RecurrenceRuleId==null filter) vs :467/:487 (which filter).
import { provision, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })
const today = new Date()
const start = today.toISOString().slice(0, 10)
const end = new Date(today.getTime() + 300 * 86400000).toISOString().slice(0, 10)

const mk = await api('POST', '/api/recurrence-rules', { token: A.token, body: {
  Title: 'tmpl-resolve', Type: 'EveryNDays', TimeOfDay: '09:00:00',
  StartDate: start, EndDate: end, IntervalDays: 3,
}})
const ruleId = mk.json?.Id ?? mk.json?.id
const templateTaskId = mk.json?.TaskId ?? mk.json?.taskId
console.log('rule id =', ruleId, ' template TaskId =', templateTaskId)

// DB before
const before = await dbTemplate(ruleId)
console.log('template before:', before)

const res = await api('POST', `/api/tasks/${templateTaskId}/resolve`, { token: A.token, body: { Action: 'Skipped' } })
console.log('POST resolve(Skipped) on template task ->', res.status, '(expected: 404 NotFound)')

const after = await dbTemplate(ruleId)
console.log('template after: ', after)

// cleanup
if (ruleId) await api('DELETE', `/api/recurrence-rules/${ruleId}`, { token: A.token })

const confirmed = res.status === 200 && after && after.Status === 'Unassigned' && (after.StartDateTime === null || after.StartDateTime === '')
console.log('\n' + (confirmed
  ? `CONFIRMED — resolve succeeded (200) on a rule template and nulled its StartDateTime / set Unassigned ` +
    `(expected 404). Template invariant corrupted.`
  : `REFUTED — resolve status=${res.status}, template status=${after?.Status}`))

import { execFileSync } from 'node:child_process'
function dbTemplate(ruleId) {
  const sql = `SELECT Status, IFNULL(StartDateTime,'NULL') FROM Tasks WHERE RecurrenceRuleId=${ruleId};`
  const out = execFileSync('docker', ['exec','planner-mysql','mysql','-N','-uplanner','-pplanner_dev_password','planner','-e',sql], { encoding:'utf8' }).trim()
  if (!out) return null
  const [Status, StartDateTime] = out.split(/\t/)
  return { Status, StartDateTime: StartDateTime === 'NULL' ? null : StartDateTime }
}
