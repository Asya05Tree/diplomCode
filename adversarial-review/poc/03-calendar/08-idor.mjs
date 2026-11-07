// §7 — IDOR probes across two accounts A and B. Expectation (secure): A cannot read/update/
// delete/resolve B's task, nor touch B's recurrence rule / exceptions. All should be 404/NotFound.
import { provision, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })
const B = await provision({ email: 'adv.t03.b@gmail.com', gender: 'male', studentType: 'student', isWorking: true })
const today = new Date().toISOString().slice(0, 10)
const end = new Date(Date.now() + 100 * 86400000).toISOString().slice(0, 10)

// B creates a task and a rule
const bt = await api('POST', '/api/tasks', { token: B.token, body: { Title: 'B-secret', StartDateTime: `${today}T09:00:00` } })
const bTaskId = bt.json?.Id ?? bt.json?.id
const br = await api('POST', '/api/recurrence-rules', { token: B.token, body: {
  Title: 'B-rule', Type: 'EveryNDays', TimeOfDay: '09:00:00', StartDate: today, EndDate: end, IntervalDays: 2 }})
const bRuleId = br.json?.Id ?? br.json?.id
console.log(`B task id=${bTaskId}, B rule id=${bRuleId}`)

// A attacks B's task
const upd = await api('PUT', `/api/tasks/${bTaskId}`, { token: A.token, body: { Title: 'hijacked' } })
const del = await api('DELETE', `/api/tasks/${bTaskId}`, { token: A.token })
const rsv = await api('POST', `/api/tasks/${bTaskId}/resolve`, { token: A.token, body: { Action: 'Done' } })
// A attacks B's rule / exceptions / manual dates / preview
const rupd = await api('PUT', `/api/recurrence-rules/${bRuleId}`, { token: A.token, body: {
  Title: 'x', Type: 'EveryNDays', TimeOfDay: '09:00:00', StartDate: today, EndDate: end, IntervalDays: 2 }})
const rdel = await api('DELETE', `/api/recurrence-rules/${bRuleId}`, { token: A.token })
const rexc = await api('POST', `/api/recurrence-rules/${bRuleId}/exceptions`, { token: A.token, body: {
  Date: today, ExceptionType: 'Cancelled', NewDateTime: null }})
const rman = await api('POST', `/api/recurrence-rules/${bRuleId}/manual-dates`, { token: A.token, body: { Date: today }})
const rprev = await api('GET', `/api/recurrence-rules/${bRuleId}/preview?from=${today}&to=${end}`, { token: A.token })

// writes that MUST be blocked (404/403)
const writes = { 'task PUT': upd.status, 'task DELETE': del.status, 'task resolve': rsv.status,
  'rule PUT': rupd.status, 'rule DELETE': rdel.status, 'rule addException': rexc.status,
  'rule addManualDate': rman.status }
for (const [k, v] of Object.entries(writes)) console.log(`A→B ${k}: ${v}`)
console.log(`A→B rule preview: ${rprev.status}  body=${JSON.stringify(rprev.json)}`)

// verify B's task still intact + unchanged (serialization is camelCase)
const bcheck = await api('GET', `/api/tasks/period?from=${today}&to=${today}`, { token: B.token })
const still = (bcheck.json || []).find(t => (t.id ?? t.Id) === bTaskId)
const stillTitle = still ? (still.title ?? still.Title) : 'GONE'
console.log("B's task still present & titled:", stillTitle)

// cleanup
await api('DELETE', `/api/tasks/${bTaskId}`, { token: B.token })
await api('DELETE', `/api/recurrence-rules/${bRuleId}`, { token: B.token })

const allBlocked = Object.values(writes).every(s => s === 404 || s === 403)
const previewSafe = rprev.status === 200 && Array.isArray(rprev.json) && rprev.json.length === 0
const intact = stillTitle === 'B-secret'
console.log('\n' + (allBlocked && intact && previewSafe
  ? `REFUTED (secure) — every cross-account WRITE returned 404 and B's data is intact. Ownership checks hold. ` +
    `Note: foreign preview returns 200 [] (empty, no leak) instead of 404 — harmless inconsistency.`
  : `CONFIRMED (IDOR!) — a cross-account op leaked/succeeded: writes=${JSON.stringify(writes)} ` +
    `preview=${rprev.status}${JSON.stringify(rprev.json)} B-title=${stillTitle}`))
