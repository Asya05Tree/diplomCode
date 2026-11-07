// §6 #1 (CRITICAL) — Category is NOT validated against the 33-key allowlist.
// AddTransaction/UpdateTransaction accept arbitrary nullable string as Category.
// Result: the net is counted in CategoryNets ("Є зараз") but the row is invisible
// in the Categories tab (UI only renders FINANCE_CATEGORIES) -> orphaned net,
// and categoryName() renders the raw key verbatim to the user.
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t08.a@gmail.com', gender: 'female' })

const junk = [
  '<script>alert(1)</script>',
  'НЕ_ІСНУЮЧА_КАТЕГОРІЯ',
  '../../etc/passwd',
  'a'.repeat(300),            // also probes Category length (no MaxLength on model)
  'drop_table_💸',
]

let confirmed = false
for (const cat of junk) {
  const r = await api('POST', '/api/finance/transactions', {
    token: u.token,
    body: { amount: 123.45, type: 'Expense', category: cat, description: 'orphan' },
  })
  const ok = r.status === 200
  console.log(`category(len=${cat.length}) -> HTTP ${r.status} ${ok ? 'ACCEPTED id=' + r.json.id : r.text}`)
  if (ok) confirmed = true
}

// Prove it is counted in CategoryNets but absent from the known allowlist.
const fin = await api('GET', '/api/finance', { token: u.token })
const allowlist = new Set(['food','housing','utilities','communication','transport','car','health','household','clothing','entertainment','dining','hobbies','beauty','sport','subscriptions','shopping','pocket','travel','car_repair','taxes','gifts','home_big','education','medical','renovation','kids','pets','loans','savings','investments','insurance','charity','family_help'])
const orphans = (fin.json.categoryNets || []).filter((c) => !allowlist.has(c.category))
console.log('')
console.log('Orphaned CategoryNets (counted in "Є зараз" but NOT shown in Categories tab):')
for (const o of orphans) console.log('  ', JSON.stringify(o.category).slice(0, 60), '=>', o.net)

console.log('')
console.log('Expected: server rejects unknown category keys (400 invalid_category).')
console.log('Observed: arbitrary keys accepted & aggregated into net.')
console.log(confirmed && orphans.length > 0 ? 'CONFIRMED: no server-side category allowlist; orphaned nets created.' : 'REFUTED')
