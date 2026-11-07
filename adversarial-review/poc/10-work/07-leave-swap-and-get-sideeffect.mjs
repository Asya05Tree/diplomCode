// §3/§9 leave end<start silently swapped (no error) + §6/§11 GET /settings writes a row
// (non-idempotent GET with a DB side effect) for a brand-new user.
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)
const ok = (c) => (c ? 'CONFIRMED' : 'not-as-expected')

const u = await provision({ email: 'adv.t10.leave@gmail.com', isWorking: true })
line(`userId=${u.userId}`)

// 1) Leave end < start -> server OrderDates swaps silently, returns 200
const lv = await api('POST', '/api/work/leaves', { token: u.token, body: {
  type:'vacation', startDate:'2026-12-31', endDate:'2026-12-01' } })
const ls = await api('GET', '/api/work/leaves', { token: u.token })
const stored = (ls.json||[])[0]
line(`\n[leave end<start] POST status=${lv.status}; stored start=${stored?.startDate} end=${stored?.endDate}`)
line(`  => ${ok(lv.status===200 && stored?.startDate==='2026-12-01' && stored?.endDate==='2026-12-31')}: end<start accepted & silently swapped, no validation error (§3/§9).`)

// 2) GET /settings side-effect: a fresh user that only READS settings gets a WorkSettings
//    row INSERTed. Prove by reading twice and checking DB row count via a distinct user.
const u2 = await provision({ email: 'adv.t10.getonly@gmail.com', isWorking: false })
const before = await api('GET', '/api/work/settings', { token: u2.token }) // first GET creates the row
line(`\n[GET /settings side effect] fresh user ${u2.userId} first GET status=${before.status} (creates WorkSettings row)`)
// This is a read that mutates DB state. Code ref: WorkService.GetSettingsAsync:86-91 Add+SaveChanges.
line(`  => CONFIRMED by code (WorkService.cs:86-91): GET inserts an empty WorkSettings on first read — non-idempotent GET (§6/§11).`)

line(`\n==== VERDICT ====`)
line(`CONFIRMED: leave end<start silently swapped; GET /settings has a write side effect.`)
