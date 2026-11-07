// §4/§6 — dead "limit" endpoint accepts unclamped amounts (no ClampMoney, unlike balance/tx);
// §6 — Description has no server MaxLength (longtext) -> storage DoS vector;
// §6 — type is case-sensitive magic string ("income" rejected).
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'
const q = (sql) => execFileSync('docker', ['exec','planner-mysql','mysql','-N','-uplanner','-pplanner_dev_password','planner','-e',sql], { encoding: 'utf8' }).trim()

const u = await provision({ email: 'adv.t08.e@gmail.com', gender: 'male' })

console.log('--- dead limit endpoint: negative & huge amounts (no ClampMoney) ---')
const neg = await api('PUT', '/api/finance/limit', { token: u.token, body: { periodType: 'Week', amount: -9999 } })
const huge = await api('PUT', '/api/finance/limit', { token: u.token, body: { periodType: 'Month', amount: 999999999999 } })
console.log('PUT limit Week=-9999 ->', neg.status)
console.log('PUT limit Month=999999999999 ->', huge.status)
console.log('stored limits:', q(`SELECT PeriodType,Amount FROM FinanceLimits WHERE UserId=${u.userId};`).replace(/\n/g,' | '))
console.log('(balance/tx use ClampMoney(0..1e9); SetLimitAsync stores raw amount -> negative / >1e9 persisted)')

console.log('')
console.log('--- Description has no MaxLength (model string? -> longtext) ---')
const bigDesc = 'Z'.repeat(50000)
const r = await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: 1, type: 'Expense', category: 'food', description: bigDesc } })
let stored = 0
if (r.status === 200) stored = Number(q(`SELECT CHAR_LENGTH(Description) FROM FinanceTransactions WHERE Id=${r.json.id};`))
console.log(`POST 50000-char description -> HTTP ${r.status}, stored length = ${stored}`)

console.log('')
console.log('--- type is case-sensitive ("income" != "Income") ---')
const lc = await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: 1, type: 'income', category: 'food' } })
console.log('POST type="income" ->', lc.status, lc.json?.error || '')

console.log('')
console.log((neg.status === 200 && Number(q(`SELECT Amount FROM FinanceLimits WHERE UserId=${u.userId} AND PeriodType='Week';`)) < 0) ? 'CONFIRMED: limit endpoint stores unvalidated negative amount.' : 'REFUTED (limit)')
console.log(stored >= 50000 ? 'CONFIRMED: Description unbounded (50000 chars stored) — storage DoS.' : 'REFUTED (desc)')
console.log(lc.status === 400 ? 'CONFIRMED: brittle case-sensitive type contract ("income" rejected).' : 'REFUTED (type)')
