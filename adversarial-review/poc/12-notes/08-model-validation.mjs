// §6-M — Add does not validate the model. record NoteRequest(string Text, string Color)
// with JSON {} gives both null. Clamp(null) saves "", Color null => default "#fff3b0".
// So a completely empty body creates a valid empty note (also §10-L: empty note eats a slot).
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t12.a@gmail.com', gender: 'female' })

// 1) Empty JSON body {}
const r1 = await api('POST', '/api/notes', { token: u.token, body: {} })
console.log(`POST {} -> ${r1.status}  body=${r1.text.slice(0, 80)}`)
let created1
if (r1.json?.id) {
  created1 = (await api('GET', '/api/notes', { token: u.token })).json.find((n) => n.id === r1.json.id)
  console.log(`   created note: ${JSON.stringify(created1)}  (Text="" , Color defaulted)`)
}

// 2) null text / null color explicitly
const r2 = await api('POST', '/api/notes', { token: u.token, body: { text: null, color: null } })
console.log(`POST {text:null,color:null} -> ${r2.status}`)
if (r2.json?.id) {
  const c2 = (await api('GET', '/api/notes', { token: u.token })).json.find((n) => n.id === r2.json.id)
  console.log(`   created note: ${JSON.stringify(c2)}`)
}

console.log(`\nEXPECTED: 400 on missing/empty required fields`)
console.log(`OBSERVED: empty/null bodies accepted (200) → empty notes created, color defaulted`)
console.log(r1.status === 200 ? 'CONFIRMED 🟡 — no [Required]/model validation; {} creates an empty note' : 'REFUTED')
