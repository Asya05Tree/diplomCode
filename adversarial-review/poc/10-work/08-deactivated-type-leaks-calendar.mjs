// §9.4 (🟡) — deactivating a shift type hides it from the WORK calendar/next-shift
// (LoadEntriesWithRulesAsync filters ShiftType.IsActive, WorkService.cs:295) BUT the
// underlying RecurrenceRule stays, and the SHARED planner calendar
// (TaskService.GetTasksForRangeAsync) materialises ALL rules with no IsActive filter.
// Result: "I turned the shift off" yet it still shows in the main calendar.
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)
const ok = (c) => (c ? 'CONFIRMED' : 'not-as-expected')

const u = await provision({ email: 'adv.t10.deact@gmail.com', isWorking: true })
const t = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: 'DEACT-SHIFT', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
const typeId = t.json.id
await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: {
  type:'EveryNDays', timeOfDay:'09:00:00', startDate:'2026-12-01', endDate:'2026-12-31',
  cycleWeeks:null, cycleAnchorDate:null, weekDaysPattern:null, weekDayTimesPattern:null,
  intervalDays:1, monthDayMode:null, monthDays:null, monthDayTimesPattern:null } } })

const before = await api('GET', '/api/work/schedule/calendar?from=2026-12-01&to=2026-12-31', { token: u.token })
line(`[active] work calendar items=${(before.json||[]).length}`)

// Deactivate the shift type
await api('PUT', `/api/work/shift-types/${typeId}`, { token: u.token, body: {
  name:'DEACT-SHIFT', color:'#ffd59e', startTime:'09:00:00', endTime:'17:00:00', kind:'normal', isActive:false } })

const workCal = await api('GET', '/api/work/schedule/calendar?from=2026-12-01&to=2026-12-31', { token: u.token })
line(`[deactivated] work calendar items=${(workCal.json||[]).length} (expected 0 — filtered by IsActive)`)

const shared = await api('GET', '/api/tasks/period?from=2026-12-01&to=2026-12-31', { token: u.token })
const arr = Array.isArray(shared.json) ? shared.json : (shared.json?.items || shared.json?.tasks || [])
const deactInShared = arr.filter(x => (x.title||'') === 'DEACT-SHIFT').length
line(`[deactivated] SHARED planner calendar still shows 'DEACT-SHIFT' instances: ${deactInShared}`)

line(`\n==== VERDICT ====`)
line(`${ok((workCal.json||[]).length===0 && deactInShared>0)}: deactivated shift hidden in Work tab but STILL in shared calendar (IsActive not honoured by TaskService). §9.4 🟡`)
