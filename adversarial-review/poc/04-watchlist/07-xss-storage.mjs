// §8 — XSS payloads in title/author/review are stored verbatim (no server sanitization).
// Rendering safety relies on React text-node escaping (Watchlist.jsx uses {item.title}
// etc., no dangerouslySetInnerHTML) — verified by static read, noted below.
// This PoC proves the raw payload round-trips through the API & DB unmodified.
import { provision, api } from '../_lib/provision.mjs'
import { db } from './_db.mjs'

const U = await provision({ email: 'adv.t04.xss@gmail.com' })
const tok = U.token

const payload = '<img src=x onerror=alert(1)>'
const multiline = 'line1<tag>&amp;\nline2 & <b>bold</b>'

const m = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: payload, author: 'X' } })
const id = m.json.id
await api('POST', `/api/media/${id}/schedule`, { token: tok, body: { startDateTime: '2030-01-01T10:00:00' } })
const done = await api('PUT', `/api/media/${id}/status`, { token: tok, body: { status: 'done', ratingStars: 3, review: multiline } })

const [[dbTitle, dbReview]] = db(`SELECT Title, Review FROM MediaItems WHERE Id=${id};`)
console.log(`API title echoed: ${JSON.stringify(done.json.title)}`)
console.log(`API review echoed: ${JSON.stringify(done.json.review)}`)
console.log(`DB  title stored: ${JSON.stringify(dbTitle)}`)
console.log(`DB  review stored: ${JSON.stringify(dbReview)}`)

// The calendar reading-event title also inherits the payload ("Прочитати: <img...>")
const evt = db(`SELECT Title FROM Tasks WHERE SourceEntityId=${id} AND SourceModule='media';`)
console.log(`Calendar event title inherits payload: ${JSON.stringify(evt[0]?.[0])}`)

const storedRaw = done.json.title === payload && dbTitle === payload
console.log('\n==== RESULT ====')
console.log(`Payload stored verbatim (no server sanitization): ${storedRaw ? 'CONFIRMED' : 'NO'}`)
console.log('Render safety: Watchlist.jsx renders {item.title}/{item.review} as JSX text nodes (React auto-escapes); no dangerouslySetInnerHTML present -> stored XSS does NOT execute in UI. Verdict: not exploitable (defense = React escaping).')
