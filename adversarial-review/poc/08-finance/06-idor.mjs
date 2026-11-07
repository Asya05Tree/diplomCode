// §7 — IDOR: user A tries to read/update/delete user B's transaction and balance.
// Also forged-JWT acting as B (committed dev key). Expectation: all blocked because
// every query filters UserId == userId taken from JWT sub.
import { provision, api, mintToken } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t08.a@gmail.com', gender: 'female' })
const B = await provision({ email: 'adv.t08.victim@gmail.com', gender: 'male' })

// B creates a transaction
const made = await api('POST', '/api/finance/transactions', { token: B.token, body: { amount: 777, type: 'Income', category: 'food', description: 'B-secret' } })
const bTxId = made.json.id
console.log('B created tx id =', bTxId)

console.log('')
console.log('--- A (own valid token) attacks B tx id', bTxId, '---')
const rUpd = await api('PUT', `/api/finance/transactions/${bTxId}`, { token: A.token, body: { amount: 1, type: 'Expense', category: 'food' } })
const rDel = await api('DELETE', `/api/finance/transactions/${bTxId}`, { token: A.token })
console.log('A UPDATE B.tx ->', rUpd.status, rUpd.text)
console.log('A DELETE B.tx ->', rDel.status, rDel.text)

// verify B's tx still intact
const bFin = await api('GET', '/api/finance', { token: B.token })
const stillThere = (bFin.json.transactions || []).some((t) => t.id === bTxId && Number(t.amount) === 777)
console.log('B.tx still intact with amount 777 ->', stillThere)

// A cannot see B balance; set B balance via forged token acting as B? forged token = acting as B legitimately (sub=B)
console.log('')
console.log('--- forged HS256 token with committed dev key, sub = B.userId ---')
const forged = mintToken(B.userId, B.email)
const asB = await api('GET', '/api/finance', { token: forged })
console.log('forged-as-B GET /finance ->', asB.status, '(forgery works because dev signing key is the committed placeholder)')

console.log('')
const idorClosed = rUpd.status >= 400 && rDel.status >= 400 && stillThere
console.log(idorClosed
  ? 'REFUTED (good): cross-user IDOR on transactions is closed (UserId filter).'
  : 'CONFIRMED: IDOR — A modified/deleted B data!')
console.log(asB.status === 200
  ? 'CONFIRMED (separate global issue): JWT forgery possible — signing key is the committed dev placeholder.'
  : 'forged token rejected')
