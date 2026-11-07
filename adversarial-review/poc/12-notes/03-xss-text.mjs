// §8-I (POSITIVE) — Stored XSS via note text does NOT execute.
// Server stores the raw text verbatim (no sanitization). Safety rests entirely on the
// client render: Notes.jsx:78-85 puts it in a <textarea value={note.text}> and the counter
// prints {note.text.length} (a number). No dangerouslySetInnerHTML / innerHTML anywhere.
// => stored verbatim but rendered as inert text. We PROVE the server stores it raw (the
// XSS would fire the moment any future markdown/innerHTML render is added).
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t12.a@gmail.com', gender: 'female' })

const payload = '<img src=x onerror=alert(document.cookie)><script>alert(1)</script>'
const add = await api('POST', '/api/notes', { token: u.token, body: { text: payload, color: '#fff3b0' } })
const id = add.json?.id
const list = (await api('GET', '/api/notes', { token: u.token })).json
const stored = list.find((n) => n.id === id)?.text

console.log(`stored verbatim on server: ${stored === payload}`)
console.log(`stored value: ${JSON.stringify(stored)}`)
console.log(`\nRender sink: Notes.jsx:78  <textarea value={note.text}> (React escapes; inert as text)`)
console.log(`EXPECTED (script-XSS): payload executes in victim DOM`)
console.log(`OBSERVED: payload stored raw but rendered as textarea value → NOT executed`)
console.log('REFUTED (script-XSS) ⚪ — no innerHTML sink; BUT server stores raw: latent stored-XSS if render ever changes')
