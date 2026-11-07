// §6 / §8 — moduleCode allowlist (TasksController.AllowedModules) is applied ONLY in
// TasksController.Create. RecurrenceRulesController.Create passes request.ModuleCode ?? "tasks"
// with NO allowlist check (controller:91). Arbitrary string persists into template task's ModuleCode.
import { provision, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })
const today = new Date()
const start = today.toISOString().slice(0, 10)
const end = new Date(today.getTime() + 300 * 86400000).toISOString().slice(0, 10)

const evil = 'tasks"><script>alert(1)</script>'
const mk = await api('POST', '/api/recurrence-rules', { token: A.token, body: {
  Title: 'mod-poison', Type: 'EveryNDays', TimeOfDay: '09:00:00',
  StartDate: start, EndDate: end, IntervalDays: 7, ModuleCode: evil,
}})
console.log('create rule with ModuleCode =', JSON.stringify(evil), '->', mk.status)
const id = mk.json?.Id ?? mk.json?.id

// Read it back
const rules = await api('GET', '/api/recurrence-rules', { token: A.token })
const found = (rules.json || []).find(r => (r.Id ?? r.id) === id)
const storedModule = found?.ModuleCode ?? found?.moduleCode
console.log('stored ModuleCode read-back =', JSON.stringify(storedModule))

// Compare: TasksController.Create coerces unknown module to "tasks"
const tk = await api('POST', '/api/tasks', { token: A.token, body: {
  Title: 'mod-compare', ModuleCode: evil, StartDateTime: `${start}T09:00:00` }})
const list = await api('GET', `/api/tasks/period?from=${start}&to=${start}`, { token: A.token })
const taskMod = (list.json || []).find(t => (t.Title ?? t.title) === 'mod-compare')
console.log('one-time task ModuleCode (allowlist applied) =', JSON.stringify(taskMod?.ModuleCode ?? taskMod?.moduleCode))

// cleanup
if (id) await api('DELETE', `/api/recurrence-rules/${id}`, { token: A.token })

const confirmed = storedModule === evil
console.log('\n' + (confirmed
  ? `CONFIRMED — rule accepts arbitrary ModuleCode (stored verbatim), bypassing the allowlist that ` +
    `TasksController enforces (which coerced the same string to "tasks"). Expected: coerce to "tasks" or 400.`
  : `REFUTED — rule ModuleCode was coerced/rejected: ${JSON.stringify(storedModule)}`))
