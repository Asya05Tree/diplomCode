// §6 / §9 (fixed, ПЛАН P2-10) — schedule/type invariants are now enforced server-side:
// duplicate shift-type names are rejected (400 duplicate_shift_type), and a single shift type
// is capped at 5 schedule entries (400 schedule_limit_per_type beyond). Direct API can no longer
// bypass the client rules. Was: 3 identical types created; 12 overlapping entries accepted.
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)
const ok = (c) => (c ? 'OK' : 'not-as-expected')

// Унікальний email на прогін: provision при email_taken лише логіниться (не чистить), тож фіксований
// email тягнув би типи/записи з минулих сесій і псував би підрахунки/перевірку унікальності.
const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t10.inv.${tag}@gmail.com`, isWorking: true })
line(`userId=${u.userId}`)

// 1) Duplicate shift types — identical name, 3 times -> only the first is accepted
const dupBody = { name: 'DUPE', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'normal' }
const d1 = await api('POST', '/api/work/shift-types', { token: u.token, body: dupBody })
const d2 = await api('POST', '/api/work/shift-types', { token: u.token, body: dupBody })
const d3 = await api('POST', '/api/work/shift-types', { token: u.token, body: dupBody })
const types = await api('GET', '/api/work/shift-types', { token: u.token })
const dupes = (types.json || []).filter(t => t.name === 'DUPE')
line(`\n[dup shift-types] statuses=${[d1,d2,d3].map(r=>r.status).join(',')} ; GET shows ${dupes.length} "DUPE" type(s)`)
const dupRefuted = d1.status === 200 && d2.status === 400 && d3.status === 400 && dupes.length === 1
line(`  => ${ok(dupRefuted)}: duplicates rejected server-side (1 kept, rest 400). §6/§9`)

// 2) >5 schedule entries for the SAME shift type -> capped at 5
const typeId = d1.json.id
const rec = {
  type: 'EveryNDays', timeOfDay: '09:00:00', startDate: '2026-01-01', endDate: null,
  cycleWeeks: null, cycleAnchorDate: null, weekDaysPattern: null, weekDayTimesPattern: null,
  intervalDays: 1, monthDayMode: null, monthDays: null, monthDayTimesPattern: null,
}
let created = 0; let rejected = 0
for (let i = 0; i < 12; i++) {
  const r = await api('POST', '/api/work/schedule', { token: u.token, body: { shiftTypeId: typeId, recurrence: rec } })
  if (r.status === 200) created++; else if (r.status === 400) rejected++
}
const sched = await api('GET', '/api/work/schedule', { token: u.token })
const forType = (sched.json || []).filter(e => e.shiftTypeId === typeId).length
line(`\n[schedule entries] POSTed 12 entries for one shift; accepted ${created}, rejected ${rejected}; GET shows ${forType}`)
const capRefuted = created === 5 && forType === 5 && rejected === 7
line(`  => ${ok(capRefuted)}: server caps at 5 per shift type (rest 400). §6/§9`)

line(`\n==== VERDICT ====`)
line((dupRefuted && capRefuted)
  ? `REFUTED: shift-type uniqueness and the max-5-per-type schedule limit are enforced on the server; direct API can no longer bypass them.`
  : `CONFIRMED/partial: dupRefuted=${dupRefuted} capRefuted=${capRefuted}.`)
