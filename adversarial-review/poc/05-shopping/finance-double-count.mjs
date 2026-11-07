// §9 — ApplyReceiptTotalAsync breaks finance invariants:
//  (a) double counting: items checked WITH a price already created an Expense; the receipt
//      then creates ANOTHER Expense for the WHOLE total -> known prices counted twice.
//  (b) receipt applies to ALL IsChecked items ever (no trip/session window) -> stale items repriced.
//  (c) receipt with ZERO unknown items still injects an Expense for the full total.
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

const A = await provision({ email: 'adv.t05.double@gmail.com' })
const db = (sql) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', sql], { encoding: 'utf8' }).trim()
const add = async (text) => (await api('POST', '/api/shopping-list', { token: A.token, body: { section: 'Groceries', category: 'grocery', text } })).json.id
const check = (id, price) => api('POST', `/api/shopping-list/${id}/check`, { token: A.token, body: { price } })

// --- (b) a STALE checked item from "last week": checked now, no price ---
const stale = await add('stale-bread'); await check(stale, null)

// --- (a) milk checked WITH price 100 (creates Expense 100) ---
const milk = await add('milk'); await check(milk, 100)

// Real money actually spent at the till this trip = 300.
const r = await api('POST', '/api/shopping-list/receipt-total', { token: A.token, body: { total: 300 } })
console.log('receipt split:', JSON.stringify(r.json))

const sumExpense = db(`SELECT COALESCE(SUM(Amount),0) FROM FinanceTransactions WHERE UserId=${A.userId} AND Type='Expense';`)
const rows = db(`SELECT Amount,Category,Description FROM FinanceTransactions WHERE UserId=${A.userId} ORDER BY Id;`)
console.log('FinanceTransactions:\n' + rows)
console.log(`\nTotal recorded Expense = ${sumExpense}; actual spend at till = 300`)
console.log(Number(sumExpense) > 300
  ? `CONFIRMED (a): double counting — 100 (milk) counted in its own Expense AND inside the 300 receipt => ${sumExpense}.`
  : 'REFUTED (a)')
console.log(r.json.split.some((s) => s.itemId === stale)
  ? 'CONFIRMED (b): a previously-checked (stale) item was repriced by an unrelated receipt — no trip/session scoping (ShoppingService.cs:231-237).'
  : 'REFUTED (b)')

// --- (c) fresh user, nothing bought, receipt still writes an Expense ---
const C = await provision({ email: 'adv.t05.ghostexp@gmail.com' })
const rc = await api('POST', '/api/shopping-list/receipt-total', { token: C.token, body: { total: 777 } })
const cExp = db(`SELECT COALESCE(SUM(Amount),0) FROM FinanceTransactions WHERE UserId=${C.userId};`)
console.log(`\n[empty receipt] split=${JSON.stringify(rc.json.split)} ; Expense recorded=${cExp} (expected 0)`)
console.log(Number(cExp) === 777
  ? 'CONFIRMED (c): receipt with no checked items still injects arbitrary 777 Expense (ShoppingService.cs:250-258).'
  : 'REFUTED (c)')
