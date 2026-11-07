// §9 DoS / §8 — Pattern CONTENT is not validated at create (only non-empty), then parsed at
// read time with int.Parse (NOT TryParse). Non-numeric tokens → FormatException → 500 on every
// calendar read. Code: TaskService.cs:57 (ParseWeekDaysPattern .Select(int.Parse)),
// :133 (GenerateMonthDaysDates .Select(int.Parse)). IsValidRule only checks non-empty.
import { provision, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })
const today = new Date()
const start = today.toISOString().slice(0, 10)
const end = new Date(today.getTime() + 300 * 86400000).toISOString().slice(0, 10)
const from = start
const to = new Date(today.getTime() + 31 * 86400000).toISOString().slice(0, 10)

async function test(label, body) {
  const mk = await api('POST', '/api/recurrence-rules', { token: A.token, body })
  const id = mk.json?.Id ?? mk.json?.id
  let periodStatus = 'n/a', snippet = ''
  if (mk.status === 200) {
    const p = await api('GET', `/api/tasks/period?from=${from}&to=${to}`, { token: A.token })
    periodStatus = p.status
    snippet = (p.text || '').split('\n')[0].slice(0, 90)
    // cleanup so the rule doesn't poison later reads
    await api('DELETE', `/api/recurrence-rules/${id}`, { token: A.token })
  }
  console.log(`${label}: create=${mk.status} id=${id ?? '-'}  GET period=${periodStatus}  ${snippet}`)
  return mk.status === 200 && periodStatus >= 500
}

const r1 = await test('MonthDays="abc"', {
  Title: 'bad-monthdays', Type: 'MonthDays', TimeOfDay: '09:00:00',
  StartDate: start, EndDate: end, MonthDayMode: 'Specific', MonthDays: 'abc',
})
const r2 = await test('WeekDaysPattern="0:x"', {
  Title: 'bad-weekpat', Type: 'WeekCycle', TimeOfDay: '09:00:00',
  StartDate: start, EndDate: end, CycleWeeks: 1, WeekDaysPattern: '0:x',
})
const r3 = await test('MonthDays="99999999999"(overflow)', {
  Title: 'ovf-monthdays', Type: 'MonthDays', TimeOfDay: '09:00:00',
  StartDate: start, EndDate: end, MonthDayMode: 'Specific', MonthDays: '99999999999',
})

console.log('\n' + ((r1 || r2 || r3)
  ? `CONFIRMED — malformed pattern content accepted at create, then 500 at read (expected: 400 invalid_rule). ` +
    `MonthDays-abc=${r1} WeekPat-0:x=${r2} overflow=${r3}`
  : 'REFUTED — no 500 from malformed patterns'))
