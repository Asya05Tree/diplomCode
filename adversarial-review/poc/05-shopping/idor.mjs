// §7 — IDOR over shopping items (A attacks B). Expected per code: all scoped by UserId -> 404.
import { provision, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t05.idor.a@gmail.com' })
const B = await provision({ email: 'adv.t05.idor.b@gmail.com' })

// B creates an item.
const add = await api('POST', '/api/shopping-list', { token: B.token, body: { section: 'Groceries', category: 'grocery', text: 'victim-milk' } })
const victimId = add.json.id
console.log(`B(user ${B.userId}) created item id=${victimId}`)

let fails = 0
const expect404 = (label, status) => {
  const ok = status === 404
  if (!ok) fails++
  console.log(`${ok ? 'OK' : 'LEAK'}  ${label}: observed ${status}, expected 404`)
}

expect404('A DELETE B.item', (await api('DELETE', `/api/shopping-list/${victimId}`, { token: A.token })).status)
expect404('A POST  B.item/check', (await api('POST', `/api/shopping-list/${victimId}/check`, { token: A.token, body: { price: 5 } })).status)
expect404('A PUT   B.item/category', (await api('PUT', `/api/shopping-list/${victimId}/category`, { token: A.token, body: { category: 'hacked' } })).status)

// Confirm B's item is untouched.
const list = await api('GET', '/api/shopping-list', { token: B.token })
const still = list.json.items.find((x) => x.id === victimId)
console.log(`B.item after attacks: isChecked=${still?.isChecked} category=${still?.category} (expected false / grocery)`)

console.log(fails === 0
  ? '\nREFUTED (verified-OK): item IDOR not possible — every op scoped by UserId (ShoppingService.cs:147,156,169).'
  : `\nCONFIRMED: ${fails} cross-user operation(s) succeeded — IDOR present.`)
