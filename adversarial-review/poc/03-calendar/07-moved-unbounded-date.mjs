// §10 — Moved.NewDateTime is NOT bounded on the server (no past / beyond-EndDate / within-year
// check). UI sets min=today on the new date, but the API accepts anything. An occurrence can be
// "moved" into the past or far beyond the rule horizon. AddExceptionAsync (TaskService.cs:653).
import { provision, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })
const today = new Date()
const start = today.toISOString().slice(0, 10)
const end = new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10) // rule horizon 60 days
const occ = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)       // an occurrence tomorrow

const mk = await api('POST', '/api/recurrence-rules', { token: A.token, body: {
  Title: 'moved-unbounded', Type: 'EveryNDays', TimeOfDay: '09:00:00',
  StartDate: start, EndDate: end, IntervalDays: 1,
}})
const ruleId = mk.json?.Id ?? mk.json?.id

const past = await api('POST', `/api/recurrence-rules/${ruleId}/exceptions`, { token: A.token, body: {
  Date: occ, ExceptionType: 'Moved', NewDateTime: '1990-01-01T09:00:00' }})
console.log('Move occurrence into the PAST (1990) ->', past.status)

// A second rule to test far-future beyond EndDate
const mk2 = await api('POST', '/api/recurrence-rules', { token: A.token, body: {
  Title: 'moved-future', Type: 'EveryNDays', TimeOfDay: '09:00:00',
  StartDate: start, EndDate: end, IntervalDays: 1,
}})
const ruleId2 = mk2.json?.Id ?? mk2.json?.id
const future = await api('POST', `/api/recurrence-rules/${ruleId2}/exceptions`, { token: A.token, body: {
  Date: occ, ExceptionType: 'Moved', NewDateTime: '2099-12-31T09:00:00' }})
console.log('Move occurrence BEYOND EndDate+year (2099) ->', future.status)

// cleanup
for (const r of [ruleId, ruleId2]) if (r) await api('DELETE', `/api/recurrence-rules/${r}`, { token: A.token })

const confirmed = past.status === 200 && future.status === 200
console.log('\n' + (confirmed
  ? `CONFIRMED — Moved.NewDateTime accepted into the past (1990) and beyond horizon (2099) ` +
    `(expected: reject dates in past / outside [StartDate, StartDate+1y]).`
  : `REFUTED — past=${past.status}, future=${future.status}`))
