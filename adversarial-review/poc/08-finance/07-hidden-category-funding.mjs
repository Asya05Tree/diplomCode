// §9 — a HIDDEN category can still be funded (UI claims "не можна вносити"), and the
// write silently UN-hides it (UnhideIfNeededAsync). Also §7 — SetCategoryHidden accepts
// an arbitrary (non-allowlist) key.
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t08.d@gmail.com', gender: 'female' })

console.log('--- hide a valid category, then fund it via API ---')
await api('PUT', '/api/finance/categories/food/hidden', { token: u.token, body: { hidden: true } })
let fin = await api('GET', '/api/finance', { token: u.token })
console.log('hidden set after hide:', JSON.stringify(fin.json.hiddenCategories))

const add = await api('POST', '/api/finance/transactions', { token: u.token, body: { amount: 50, type: 'Expense', category: 'food' } })
console.log('POST expense into hidden "food" ->', add.status, add.status === 200 ? 'ACCEPTED (UI claims this is impossible)' : add.text)

fin = await api('GET', '/api/finance', { token: u.token })
console.log('hidden set after funding:', JSON.stringify(fin.json.hiddenCategories), '<-- "food" silently removed (un-hidden)')
const unhidden = !(fin.json.hiddenCategories || []).includes('food')

console.log('')
console.log('--- SetCategoryHidden accepts an arbitrary non-allowlist key ---')
const junkHide = await api('PUT', '/api/finance/categories/__not_a_real_key__/hidden', { token: u.token, body: { hidden: true } })
fin = await api('GET', '/api/finance', { token: u.token })
const junkStored = (fin.json.hiddenCategories || []).includes('__not_a_real_key__')
console.log('PUT hide "__not_a_real_key__" ->', junkHide.status, '| stored in hidden set ->', junkStored)

console.log('')
console.log(add.status === 200 && unhidden ? 'CONFIRMED: hidden category can be funded and is silently un-hidden (contradicts UI text).' : 'REFUTED (funding)')
console.log(junkHide.status === 200 && junkStored ? 'CONFIRMED: arbitrary category key can be hidden (no allowlist on hide endpoint).' : 'REFUTED (junk hide)')
