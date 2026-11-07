// §9 HIGH / §11 — Two RecurrenceExceptions on the SAME Date → ToDictionary(e=>e.Date)
// throws ArgumentException (duplicate key) → 500 on EVERY day/period/preview request.
// Self-DoS that "kills" the user's whole calendar until the duplicate is removed.
// Code: TaskService.cs:187 PreviewOccurrences, :211 GetEffectiveOccurrences.
import { provision, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })

// 1) Create a weekly rule (every Monday, ISO day 1) spanning this year.
const today = new Date()
const start = today.toISOString().slice(0, 10)
const end = new Date(today.getTime() + 300 * 86400000).toISOString().slice(0, 10)
const mk = await api('POST', '/api/recurrence-rules', { token: A.token, body: {
  Title: 'dup-exc', Type: 'WeekCycle', TimeOfDay: '09:00:00',
  StartDate: start, EndDate: end, CycleWeeks: 1, WeekDaysPattern: '0:1,2,3,4,5,6,7',
}})
const rule = mk.json
console.log('create rule:', mk.status, 'id=', rule?.Id ?? rule?.id)
const ruleId = rule.Id ?? rule.id

// pick a concrete occurrence date (tomorrow) to attach exceptions to
const exDate = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)

const e1 = await api('POST', `/api/recurrence-rules/${ruleId}/exceptions`, { token: A.token, body: {
  Date: exDate, ExceptionType: 'Cancelled', NewDateTime: null }})
const e2 = await api('POST', `/api/recurrence-rules/${ruleId}/exceptions`, { token: A.token, body: {
  Date: exDate, ExceptionType: 'Moved', NewDateTime: `${exDate}T12:00:00` }})
console.log('exception #1 (Cancelled):', e1.status)
console.log('exception #2 (Moved, SAME date):', e2.status, '  <- no uniqueness check')

// Now read the calendar.
const mFrom = start
const mTo = new Date(today.getTime() + 31 * 86400000).toISOString().slice(0, 10)
const day = await api('GET', `/api/tasks/day?date=${exDate}`, { token: A.token })
const period = await api('GET', `/api/tasks/period?from=${mFrom}&to=${mTo}`, { token: A.token })
const preview = await api('GET', `/api/recurrence-rules/${ruleId}/preview?from=${mFrom}&to=${mTo}`, { token: A.token })

console.log('\nGET /tasks/day    ->', day.status)
console.log('GET /tasks/period ->', period.status)
console.log('GET .../preview   ->', preview.status)
console.log('period body (first 200):', (period.text || '').slice(0, 200))

const broke = day.status >= 500 || period.status >= 500 || preview.status >= 500
console.log('\n' + (broke
  ? 'CONFIRMED — duplicate exception on same date causes 500 (expected: accepted both exceptions + working calendar). Observed: ' +
    `day=${day.status} period=${period.status} preview=${preview.status}. Self-DoS of entire calendar.`
  : `REFUTED — no 500 (day=${day.status} period=${period.status} preview=${preview.status})`))
