// §6 / §9 (🟠) — all key schedule/type invariants live only on the client and are
// bypassable by direct API: duplicate shift types (same name/color/time), >5 schedule
// entries for one shift, fully overlapping entries of the SAME shift.
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)
const ok = (c) => (c ? 'CONFIRMED' : 'not-as-expected')

const u = await provision({ email: 'adv.t10.inv@gmail.com', isWorking: true })
line(`userId=${u.userId}`)

// 1) Duplicate shift types — identical name/color/time, 3 times
const dupBody = { name: 'DUPE', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' }
const d1 = await api('POST', '/api/work/shift-types', { token: u.token, body: dupBody })
const d2 = await api('POST', '/api/work/shift-types', { token: u.token, body: dupBody })
const d3 = await api('POST', '/api/work/shift-types', { token: u.token, body: dupBody })
const types = await api('GET', '/api/work/shift-types', { token: u.token })
const dupes = (types.json || []).filter(t => t.name === 'DUPE')
line(`\n[dup shift-types] created ids=${[d1,d2,d3].map(r=>r.json?.id).join(',')} ; GET shows ${dupes.length} identical "DUPE" types`)
line(`  => ${ok(dupes.length === 3)}: server allows duplicate types (client §ScheduleTab:82-85 blocks, API does not). §6/§9`)

// 2) >5 schedule entries for the SAME shift type, all overlapping (same recurrence)
const typeId = d1.json.id
const rec = {
  type: 'EveryNDays', timeOfDay: '09:00:00', startDate: '2026-01-01', endDate: null,
  cycleWeeks: null, cycleAnchorDate: null, weekDaysPattern: null, weekDayTimesPattern: null,
  intervalDays: 1, monthDayMode: null, monthDays: null, monthDayTimesPattern: null,
}
let created = 0
for (let i = 0; i < 12; i++) {
  const r = await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: rec } })
  if (r.status === 200) created++
}
const sched = await api('GET', '/api/work/schedule', { token: u.token })
const forType = (sched.json || []).filter(e => e.shiftTypeId === typeId).length
line(`\n[schedule entries] POSTed 12 overlapping daily entries for one shift; server accepted ${created}; GET shows ${forType}`)
line(`  => ${ok(created === 12)}: server has no max-5 limit and no overlap guard (client §ScheduleTab:150-157). §6/§9`)

line(`\n==== VERDICT ====`)
line(`${ok(dupes.length===3 && created===12)}: schedule/type uniqueness, max-5 and overlap are client-only; direct API bypasses them.`)
