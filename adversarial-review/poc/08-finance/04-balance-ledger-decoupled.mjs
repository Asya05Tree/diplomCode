// §8 / §9 (CRITICAL business-logic) — balance is fully decoupled from the ledger.
// Adding income/expense transactions does NOT move FinanceAccount.Balance.
// Balance is a single manually-edited number that drives food/shopping budgeting.
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t08.c@gmail.com', gender: 'female' })

// set a known balance
await api('PUT', '/api/finance/balance', { token: u.token, body: { balance: 5000 } })
const before = (await api('GET', '/api/finance', { token: u.token })).json.balance
console.log('balance before =', before)

// record a large expense and a large income
await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: 4000, type: 'Expense', category: 'food', description: 'spent' } })
await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: 1000, type: 'Income', category: 'savings', description: 'got paid' } })

const after = (await api('GET', '/api/finance', { token: u.token })).json.balance
console.log('balance after expense 4000 + income 1000 =', after)
console.log('ledger net of those two ops = ', 1000 - 4000, '(income - expense)')

console.log('')
console.log('Expected (if invariant held): balance would reflect the ledger movement.')
console.log('Observed: balance unchanged =', after, '— no "balance = Σincome − Σexpense" invariant.')
console.log(before === after ? 'CONFIRMED: balance and ledger are decoupled; the number that drives Food/Shopping budgeting ignores recorded spending.' : 'REFUTED')
