// §9.4 — деактивація типу зміни тепер ховає його і з вкладки Роботи, і зі СПІЛЬНОГО календаря.
// FIXED (залишок 10-work/08): TaskService.GetTasksForRangeAsync пропускає правила, чий WorkShiftType
// деактивовано (inactiveShiftRuleIds), тож «вимкнена зміна» зникає скрізь.
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t10.deact.${tag}@gmail.com`, isWorking: true })
const t = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: 'DEACT-SHIFT', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' } })
const typeId = t.json.id
await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: {
  type: 'EveryNDays', timeOfDay: '09:00:00', startDate: '2026-12-01', endDate: '2026-12-31',
  cycleWeeks: null, cycleAnchorDate: null, weekDaysPattern: null, weekDayTimesPattern: null,
  intervalDays: 1, monthDayMode: null, monthDays: null, monthDayTimesPattern: null } } })

const beforeWork = await api('GET', '/api/work/schedule/calendar?from=2026-12-01&to=2026-12-31', { token: u.token })
const beforeShared = await api('GET', '/api/tasks/period?from=2026-12-01&to=2026-12-31', { token: u.token })
const sharedCount = (j) => (Array.isArray(j) ? j : (j?.items || j?.tasks || [])).filter(x => (x.title || '') === 'DEACT-SHIFT').length
line(`[active] work calendar=${(beforeWork.json || []).length}; shared calendar=${sharedCount(beforeShared.json)} (обидва > 0)`)

// Деактивуємо тип зміни
await api('PUT', `/api/work/shift-types/${typeId}`, { token: u.token, body: {
  name: 'DEACT-SHIFT', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal', isActive: false } })

const workCal = await api('GET', '/api/work/schedule/calendar?from=2026-12-01&to=2026-12-31', { token: u.token })
const shared = await api('GET', '/api/tasks/period?from=2026-12-01&to=2026-12-31', { token: u.token })
const workAfter = (workCal.json || []).length
const sharedAfter = sharedCount(shared.json)
line(`[deactivated] work calendar=${workAfter} (очік. 0); shared calendar=${sharedAfter} (очік. 0)`)

const refuted = (beforeWork.json || []).length > 0 && workAfter === 0 && sharedAfter === 0
line(`\n==== VERDICT ====`)
line(refuted
  ? 'REFUTED — деактивована зміна зникає і з вкладки Роботи, і зі спільного календаря (IsActive тепер ' +
    'шанується і в TaskService).'
  : `CONFIRMED/partial — workAfter=${workAfter} sharedAfter=${sharedAfter}`)
