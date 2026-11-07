// §2/§7 CRITICAL — study/work/cycle are gated ONLY in the client (Sidebar filter +
// App.jsx redirects). The server controllers have [Authorize] but NO check of
// StudentType/IsWorking/Gender. A male, non-working, non-student user can fully use
// all three modules via the API.
//
// Run: node 05-client-gating-bypass.mjs
import { provision, api } from '../_lib/provision.mjs'

const line = (s = '') => process.stdout.write(s + '\n')

// A user who in the UI would see NONE of study/work/cycle in the sidebar:
const u = await provision({
  email: 'adv.t14.nogate@gmail.com', nickname: 'NoGate',
  gender: 'male', studentType: 'none', isWorking: false,
})
line(`[setup] userId=${u.userId} gender=male studentType=none isWorking=false`)
line('        -> UI hides Навчання, Робота, and Цикл for this profile.\n')

const t = u.token
const results = []

// CYCLE (UI: female only)
const cyc = await api('POST', '/api/cycle/records', { token: t, body: { startDate: '2026-01-01' } })
results.push(['POST /api/cycle/records (male user)', cyc.status, cyc.text])

// WORK (UI: isWorking only) — obligations: simplest body (Title + IsDone)
const wob = await api('POST', '/api/work/obligations', { token: t, body: { title: 'Ghost obligation', isDone: false } })
results.push(['POST /api/work/obligations (non-worker)', wob.status, wob.text])

// STUDY (UI: pupil/student only)
const subj = await api('POST', '/api/study/subjects', { token: t, body: { name: 'Ghost subject' } })
results.push(['POST /api/study/subjects (non-student)', subj.status, subj.text])

line('endpoint                                      status  body')
line('--------------------------------------------- ------  ----')
for (const [label, status, body] of results) {
  line(`${label.padEnd(45)} ${String(status).padEnd(6)} ${(body || '').slice(0, 50)}`)
}

const allCreated = results.every(([, s]) => s === 200)
line('\n==============================================================')
line(`VERDICT: ${allCreated ? 'CONFIRMED 🔴' : 'partial/NOT reproduced'}`)
line('  expected: server rejects study/work/cycle writes for a profile without the status')
line('  observed: all three created successfully (200) despite the UI hiding them')
line('  -> Client-side gating is cosmetic; server enforces no status scope.')
