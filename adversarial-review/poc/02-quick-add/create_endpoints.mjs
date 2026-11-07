// TAB-02 §6/§7/§11 create-endpoint checks reachable from createAll.
// - ModuleCode allowlist: arbitrary/injection moduleCode silently becomes "tasks".
// - IDOR: userId/UserId injected in JSON body is ignored (owner = token sub).
// - Finance ClampMoney: negative rejected, huge clamped to 1e9, fractional rounded to 2dp.
// - Notes: no server-side 30-note limit (only client) → can exceed 30.
//
// Run: node adversarial-review/poc/02-quick-add/create_endpoints.mjs
import { execFileSync } from 'node:child_process'
import { provision, api, mintToken } from '../_lib/provision.mjs'

const ok = (c) => (c ? 'CONFIRMED' : 'refuted')
const db = (sql) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner',
  '-pplanner_dev_password', 'planner', '-e', sql], { encoding: 'utf8' }).trim()

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t02.create.${tag}@gmail.com`, gender: 'female' })
console.log('=== TAB-02 create-endpoint checks ===')
console.log(`user=${u.userId}\n`)

// --- §6 ModuleCode allowlist ---------------------------------------------
{
  const evil = "admin'; OR 1=1 --"
  const r = await api('POST', '/api/tasks', { token: u.token, body: { title: 'qa-mod', moduleCode: evil } })
  const r2 = await api('POST', '/api/tasks', { token: u.token, body: { title: 'qa-mod-cycle', moduleCode: 'cycle' } })
  const stored = db(`SELECT ModuleCode FROM Tasks WHERE UserId=${u.userId} AND Title='qa-mod';`)
  console.log(`[§6 moduleCode allowlist] evil=${JSON.stringify(evil)} http=${r.status} storedModuleCode=${JSON.stringify(stored)}`)
  console.log(`   cycle (allowed server-side, NOT in client MODULES) http=${r2.status}`)
  console.log(`   => ${ok(r.status === 200 && stored === 'tasks')} unknown moduleCode silently coerced to "tasks" (no injection, no 400)`)
}

// --- §7 IDOR: userId in body ignored -------------------------------------
{
  const victim = await provision({ email: `adv.t02.victim.${tag}@gmail.com`, gender: 'male' })
  const r = await api('POST', '/api/tasks', {
    token: u.token,
    body: { title: 'qa-idor', moduleCode: 'tasks', userId: victim.userId, UserId: victim.userId },
  })
  const ownerOfIdor = db(`SELECT UserId FROM Tasks WHERE Title='qa-idor' ORDER BY Id DESC LIMIT 1;`)
  console.log(`\n[§7 IDOR body userId] attacker=${u.userId} tried to assign to victim=${victim.userId} http=${r.status} stored owner=${ownerOfIdor}`)
  console.log(`   => ${ok(r.status === 200 && Number(ownerOfIdor) === u.userId)} owner bound to token sub; body userId ignored`)
}

// --- §11 Finance ClampMoney (direct API) ---------------------------------
{
  const neg = await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: -5, type: 'Expense', description: 'neg' } })
  const huge = await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: 1e12, type: 'Expense', description: 'huge' } })
  const frac = await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: 10.999, type: 'Expense', description: 'frac' } })
  const badType = await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: 5, type: 'Donation', description: 'badtype' } })
  const hugeAmt = db(`SELECT Amount FROM FinanceTransactions WHERE UserId=${u.userId} AND Description='huge';`)
  const fracAmt = db(`SELECT Amount FROM FinanceTransactions WHERE UserId=${u.userId} AND Description='frac';`)
  console.log(`\n[§11 finance clamp] neg(-5) http=${neg.status} json=${JSON.stringify(neg.json)}`)
  console.log(`   huge(1e12) http=${huge.status} stored=${hugeAmt}`)
  console.log(`   frac(10.999) http=${frac.status} stored=${fracAmt}`)
  console.log(`   badType(Donation) http=${badType.status} json=${JSON.stringify(badType.json)}`)
  console.log(`   => ${ok(neg.status === 400 && huge.status === 200 && Number(hugeAmt) === 1000000000 && badType.status === 400)} negative/zero & invalid type rejected, amount clamped to 1e9`)
}

// --- §6/§11 Notes: no server-side 30 limit -------------------------------
{
  const n = await provision({ email: `adv.t02.notes.${tag}@gmail.com`, gender: 'female' })
  let good = 0
  for (let i = 0; i < 35; i++) {
    const r = await api('POST', '/api/notes', { token: n.token, body: { text: `note-${i}`, color: '#fff3b0' } })
    if (r.status === 200) good++
  }
  const cnt = db(`SELECT COUNT(*) FROM Notes WHERE UserId=${n.userId};`)
  // 280-char clamp check
  const long = 'x'.repeat(400)
  await api('POST', '/api/notes', { token: n.token, body: { text: long, color: '#fff3b0' } })
  const len = db(`SELECT CHAR_LENGTH(Text) FROM Notes WHERE UserId=${n.userId} ORDER BY Id DESC LIMIT 1;`)
  console.log(`\n[§6 notes limit] created ${good}/35 notes, stored count=${cnt}`)
  console.log(`   400-char note stored length=${len} (expected 280 clamp)`)
  console.log(`   => ${ok(Number(cnt) >= 31 && Number(len) === 280)} server enforces NO 30-note cap; text clamped to 280`)
}

// --- §6 consume 402 body shape (client maps Error('limit_reached')) ------
{
  const z = await provision({ email: `adv.t02.shape.${tag}@gmail.com`, gender: 'male' })
  let last
  for (let i = 0; i < 4; i++) last = await api('POST', '/api/quick-add/consume', { token: z.token })
  console.log(`\n[§6 consume 402 shape] http=${last.status} body.error=${JSON.stringify(last.json?.error)}`)
  console.log(`   => ${ok(last.status === 402 && last.json?.error === 'limit_reached')} throwApiError throws Error('limit_reached') → paywall mapping works`)
}

console.log('\n=== done ===')
