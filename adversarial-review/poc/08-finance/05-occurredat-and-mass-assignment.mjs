// §6 / §8 — client-controlled OccurredAt on CREATE (backdating), and mass-assignment
// closure on UPDATE (cannot change OccurredAt/UserId/TaskId via PUT).
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

const u = await provision({ email: 'adv.t08.a@gmail.com', gender: 'female' })
const q = (sql) => execFileSync('docker', ['exec','planner-mysql','mysql','-N','-uplanner','-pplanner_dev_password','planner','-e',sql], { encoding: 'utf8' }).trim()

console.log('--- CREATE accepts arbitrary OccurredAt (backdating / future-dating) ---')
const future = await api('POST', '/api/finance/transactions', {
  token: u.token,
  body: { amount: 10, type: 'Expense', category: 'food', description: 'time travel', occurredAt: '2099-12-31T00:00:00Z' },
})
const past = await api('POST', '/api/finance/transactions', {
  token: u.token,
  body: { amount: 10, type: 'Expense', category: 'food', description: 'ancient', occurredAt: '1900-01-01T00:00:00Z' },
})
const fId = future.json.id, pId = past.json.id
console.log(`future op id=${fId} stored OccurredAt = ${q(`SELECT OccurredAt FROM FinanceTransactions WHERE Id=${fId};`)}`)
console.log(`past   op id=${pId} stored OccurredAt = ${q(`SELECT OccurredAt FROM FinanceTransactions WHERE Id=${pId};`)}`)
const backdate = /2099/.test(q(`SELECT OccurredAt FROM FinanceTransactions WHERE Id=${fId};`))
console.log(backdate ? 'CONFIRMED: client fully controls OccurredAt on create (stats/history integrity).' : 'REFUTED')

console.log('')
console.log('--- UPDATE mass-assignment attempt: extra UserId/OccurredAt/TaskId/Id fields ---')
const before = q(`SELECT UserId,OccurredAt,TaskId FROM FinanceTransactions WHERE Id=${fId};`)
const upd = await api('PUT', `/api/finance/transactions/${fId}`, {
  token: u.token,
  body: { amount: 55, type: 'Expense', category: 'food', description: 'x', userId: 999999, occurredAt: '1800-01-01T00:00:00Z', taskId: 424242, id: 1 },
})
const after = q(`SELECT UserId,OccurredAt,TaskId FROM FinanceTransactions WHERE Id=${fId};`)
console.log('PUT status', upd.status)
console.log('before (UserId,OccurredAt,TaskId):', before)
console.log('after  (UserId,OccurredAt,TaskId):', after)
console.log(before === after
  ? 'REFUTED (good): UPDATE DTO ignores UserId/OccurredAt/TaskId — mass-assignment closed on edit.'
  : 'CONFIRMED: mass-assignment on update changed a protected field!')
