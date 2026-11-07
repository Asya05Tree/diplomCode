// §8 — SetCategoryAsync writes ANY string to Category (no whitelist, no length cap).
// That Category then flows verbatim into FinanceTransaction.Category on a priced check.
// Also: SetCategory never touches Section -> category<->section desync.
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

const A = await provision({ email: 'adv.t05.mass@gmail.com' })
const db = (sql) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', sql], { encoding: 'utf8' }).trim()

// create a Groceries item, then set category to a medicine category + junk.
const id = (await api('POST', '/api/shopping-list', { token: A.token, body: { section: 'Groceries', category: 'grocery', text: 'mass-item' } })).json.id
const junk = '<script>alert(1)</script>' + 'X'.repeat(600)
const sc = await api('PUT', `/api/shopping-list/${id}/category`, { token: A.token, body: { category: junk } })
const stored = db(`SELECT CHAR_LENGTH(Category) FROM ShoppingItems WHERE Id=${id};`)
console.log(`[arbitrary category] HTTP ${sc.status} (expected 400 reject). stored length=${stored} (expected whitelist rejection)`)
console.log(sc.status === 200 && Number(stored) > 100
  ? 'CONFIRMED: arbitrary/oversized category accepted — mass assignment (ShoppingService.cs:154-161, longtext column).\n'
  : 'REFUTED\n')

// set it to a medicine category -> section stays Groceries (desync).
await api('PUT', `/api/shopping-list/${id}/category`, { token: A.token, body: { category: 'medicine' } })
const row = db(`SELECT Section,Category FROM ShoppingItems WHERE Id=${id};`)
console.log(`[category/section desync] Section|Category = "${row}" (expected Pharmacy for medicine)`)
console.log(row.split(/\s+/)[0] === 'Groceries'
  ? 'CONFIRMED: Section not recomputed on category change (ShoppingService.cs:158 sets only Category).\n'
  : 'REFUTED\n')

// junk category -> propagates into finance on a priced check.
await api('PUT', `/api/shopping-list/${id}/category`, { token: A.token, body: { category: junk } })
await api('POST', `/api/shopping-list/${id}/check`, { token: A.token, body: { price: 10 } })
const finCat = db(`SELECT CHAR_LENGTH(Category) FROM FinanceTransactions WHERE UserId=${A.userId} AND Description='mass-item';`)
console.log(`[category -> finance] FinanceTransaction.Category length=${finCat} (expected sanitized/validated)`)
console.log(Number(finCat) > 100
  ? 'CONFIRMED: unvalidated shopping category pollutes FinanceTransaction.Category (ShoppingService.cs:201).'
  : 'REFUTED')
