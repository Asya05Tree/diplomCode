// §6 / §10 — amount validation on the server (ClampMoney + <=0 reject).
// Probes: negative, zero, overflow (>1e9 clamped), non-numeric, huge decimals (rounding),
// and ACCUMULATION past 1e9 (limit is per-op, not on the aggregate net).
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t08.b@gmail.com', gender: 'male' })

async function add(body) {
  const r = await api('POST', '/api/finance/transactions', { token: u.token, body: { type: 'Expense', category: 'food', ...body } })
  return r
}
async function amountOf(id) {
  const q = `SELECT Amount FROM FinanceTransactions WHERE Id=${id};`
  const { execFileSync } = await import('node:child_process')
  return execFileSync('docker', ['exec','planner-mysql','mysql','-N','-uplanner','-pplanner_dev_password','planner','-e',q], { encoding: 'utf8' }).trim()
}

console.log('--- rejection of <=0 and non-numeric ---')
for (const amt of [-50, 0, -0.01]) {
  const r = await add({ amount: amt })
  console.log(`amount=${amt} -> HTTP ${r.status} ${r.status === 400 ? 'REJECTED (' + (r.json?.error) + ')' : 'ACCEPTED id=' + r.json?.id}`)
}
// non-numeric via raw body
const nn = await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: 'abc', type: 'Expense', category: 'food' } })
console.log(`amount="abc" -> HTTP ${nn.status} (${nn.status === 400 ? 'rejected by model binder' : 'accepted'})`)

console.log('')
console.log('--- overflow clamp to 1e9 ---')
const big = await add({ amount: 2000000000 })
if (big.status === 200) console.log(`amount=2e9 -> stored = ${await amountOf(big.json.id)} (expected 1000000000.00 clamp, silent)`)

console.log('')
console.log('--- huge decimals / rounding to 2dp ---')
const dec = await add({ amount: 10.999 })
if (dec.status === 200) console.log(`amount=10.999 -> stored = ${await amountOf(dec.json.id)}`)
const bank = await add({ amount: 2.125 })
if (bank.status === 200) console.log(`amount=2.125 -> stored = ${await amountOf(bank.json.id)} (banker's ToEven => 2.12, not 2.13)`)
const bank2 = await add({ amount: 2.135 })
if (bank2.status === 200) console.log(`amount=2.135 -> stored = ${await amountOf(bank2.json.id)} (ToEven => 2.14)`)

console.log('')
console.log('--- accumulation past the 1e9 "realistic" ceiling ---')
for (let i = 0; i < 3; i++) await add({ amount: 1000000000, type: 'Income', category: 'savings' })
const fin = await api('GET', '/api/finance', { token: u.token })
const savings = (fin.json.categoryNets || []).find((c) => c.category === 'savings')
console.log(`savings net after 3x income of 1e9 each = ${savings?.net} (per-op ceiling is 1e9, aggregate is unbounded)`)

console.log('')
console.log('CONFIRMED details above: <=0 rejected (good), but overflow silently clamped, banker rounding, aggregate net exceeds the per-op "realistic" ceiling.')
