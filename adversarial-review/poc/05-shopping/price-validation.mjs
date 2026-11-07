// §6 / §9 / §10 — CheckItemAsync does NOT validate price (sign / upper bound).
// Negative price => negative "Expense" (effectively income). Huge price => DB overflow 500.
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

const A = await provision({ email: 'adv.t05.price@gmail.com' })
const db = (sql) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', sql], { encoding: 'utf8' }).trim()
const add = async (text) => (await api('POST', '/api/shopping-list', { token: A.token, body: { section: 'Groceries', category: 'grocery', text } })).json.id

// 1) NEGATIVE price
let id = await add('neg-item')
let r = await api('POST', `/api/shopping-list/${id}/check`, { token: A.token, body: { price: -500 } })
const neg = db(`SELECT Amount,Type FROM FinanceTransactions WHERE UserId=${A.userId} AND Description='neg-item';`)
console.log(`[neg price] check HTTP ${r.status} (expected 400). FinanceTransaction = "${neg}" (expected: rejected / no negative expense)`)
console.log(neg.startsWith('-') ? 'CONFIRMED: negative price accepted -> negative Expense row (income disguised as expense).\n'
  : 'REFUTED\n')

// 2) HUGE price within decimal(18,2) -> accepted silently
id = await add('big-ok')
r = await api('POST', `/api/shopping-list/${id}/check`, { token: A.token, body: { price: 1e15 } })
console.log(`[1e15 price] check HTTP ${r.status} (expected 400 by RANGES.money.max=1e9). ` +
  (r.status === 200 ? 'CONFIRMED: 1,000,000,000,000,000 accepted — no server upper bound.\n' : 'REFUTED\n'))

// 3) OVERFLOW price -> 500 (unhandled DbUpdateException, not 400)
id = await add('big-overflow')
r = await api('POST', `/api/shopping-list/${id}/check`, { token: A.token, body: { price: 1e16 } })
console.log(`[1e16 price] check HTTP ${r.status} (expected 400). body: ${r.text.split('\n')[0].slice(0, 90)}`)
console.log(r.status === 500 ? 'CONFIRMED: value > decimal(18,2) -> 500 MySqlException "Out of range" (crash instead of validation).\n' : 'REFUTED\n')

// 4) receipt-total: only guard is Total<0
r = await api('POST', '/api/shopping-list/receipt-total', { token: A.token, body: { total: -999 } })
console.log(`[receipt -999] HTTP ${r.status} ${r.text} (expected 400 invalid_total) -> guard WORKS`)
r = await api('POST', '/api/shopping-list/receipt-total', { token: A.token, body: { total: 1e16 } })
console.log(`[receipt 1e16] HTTP ${r.status} (expected 400). ` +
  (r.status === 500 ? 'CONFIRMED: no upper bound on receipt total -> 500 overflow.' : 'REFUTED'))
