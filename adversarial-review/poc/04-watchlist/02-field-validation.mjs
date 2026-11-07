// §6/§8/§10 — server-side field validation & mass-assignment via direct API.
import { provision, api } from '../_lib/provision.mjs'

const U = await provision({ email: 'adv.t04.valid@gmail.com' })
const tok = U.token
const results = []
const rec = (label, pass, detail) => { results.push([label, pass, detail]); console.log(`${pass ? 'PASS/expected' : 'CONFIRMED-ISSUE'}: ${label} — ${detail}`) }

// --- rating 0 -> 1 (not "no rating") on direct status done ---
let m = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'rate0' } })
let id = m.json.id
await api('POST', `/api/media/${id}/schedule`, { token: tok, body: { startDateTime: '2030-01-01T10:00:00' } })
let s = await api('PUT', `/api/media/${id}/status`, { token: tok, body: { status: 'done', ratingStars: 0 } })
rec('rating:0 via /status done', s.json.ratingStars !== 1, `ratingStars=${s.json.ratingStars} (0 expected "no rating"; 1 = BUG Math.Clamp)`)

// --- rating out of range via Update ---
let r999 = await api('PUT', `/api/media/${id}`, { token: tok, body: { title: 'rate0', ratingStars: 999 } })
rec('rating:999 via Update', r999.json.ratingStars === 5, `clamped to ${r999.json.ratingStars} (5 expected)`)
let rneg = await api('PUT', `/api/media/${id}`, { token: tok, body: { title: 'rate0', ratingStars: -5 } })
rec('rating:-5 via Update', rneg.json.ratingStars === 1, `clamped to ${rneg.json.ratingStars} (1; note negative becomes a star)`)

// --- invalid genre/type silently nulled, no 400 ---
let g = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'g', genre: '<script>alert(1)</script>', mediaType: 'xxx' } })
rec('invalid genre/type on Add', g.status === 200 && g.json.genre === null && g.json.mediaType === null,
  `status=${g.status} genre=${JSON.stringify(g.json.genre)} mediaType=${JSON.stringify(g.json.mediaType)} (silently null, no 400)`)

// --- cross-kind genre: book genre on video, video genre on book ---
let cv = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'cv', genre: 'poetry' } })
let cb = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'cb', genre: 'documentary' } })
rec('cross-kind genre rejected to null', cv.json.genre === null && cb.json.genre === null, `video.poetry=${cv.json.genre} book.documentary=${cb.json.genre}`)

// --- mediaType on book -> null ---
let bt = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: 'bt', mediaType: 'film' } })
rec('mediaType on book nulled', bt.json.mediaType === null, `mediaType=${bt.json.mediaType}`)

// --- invalid kind -> 400 ---
let ik = await api('POST', '/api/media', { token: tok, body: { kind: 'music', title: 'x' } })
rec('invalid_kind -> 400', ik.status === 400 && ik.json.error === 'invalid_kind', `status=${ik.status} ${JSON.stringify(ik.json)}`)

// --- missing title -> 400 (whitespace) ---
let mt = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: '   ' } })
rec('missing_title -> 400', mt.status === 400 && mt.json.error === 'missing_title', `status=${mt.status} ${JSON.stringify(mt.json)}`)

// --- huge payload REJECTED (fixed: [StringLength] on Title/Author -> 400, was silent truncation) ---
const big = 'A'.repeat(10000)
let hp = await api('POST', '/api/media', { token: tok, body: { kind: 'book', title: big, author: big } })
rec('10k title/author rejected (400)', hp.status === 400, `status=${hp.status}`)

// --- mass-assignment: status cannot be set via Add/Update ---
let ma = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'ma', status: 'done' } })
rec('status not mass-assignable on Add', ma.json.status === 'planned', `status=${ma.json.status} (planned expected)`)
let ma2 = await api('PUT', `/api/media/${ma.json.id}`, { token: tok, body: { title: 'ma', status: 'done', isReturned: true, taskId: 999999, returnTaskId: 888 } })
rec('status/isReturned/taskId not mass-assignable on Update', ma2.json.status === 'planned' && ma2.json.isReturned === false && ma2.json.taskId === null,
  `status=${ma2.json.status} isReturned=${ma2.json.isReturned} taskId=${ma2.json.taskId}`)

// --- rating/review writable on NON-done record (invariant violation) ---
let nd = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'nd' } })
let ndu = await api('PUT', `/api/media/${nd.json.id}`, { token: tok, body: { title: 'nd', ratingStars: 5, review: 'rated while planned' } })
rec('rating/review on planned record', ndu.json.ratingStars === 5, `planned item now status=${ndu.json.status} rating=${ndu.json.ratingStars} review=${JSON.stringify(ndu.json.review)} (API allows rating on non-done)`)

// --- isLibrary cannot be applied to a video ---
let vl = await api('POST', '/api/media', { token: tok, body: { kind: 'video', title: 'vl', isLibrary: true, returnDeadline: '2030-01-01' } })
rec('isLibrary ignored for video', vl.json.isLibrary === false && vl.json.returnDeadline === null, `isLibrary=${vl.json.isLibrary} returnDeadline=${vl.json.returnDeadline}`)
let vlu = await api('PUT', `/api/media/${vl.json.id}`, { token: tok, body: { title: 'vl', isLibrary: true, returnDeadline: '2030-01-01' } })
rec('isLibrary ignored for video via Update', vlu.json.isLibrary === false, `isLibrary=${vlu.json.isLibrary}`)

console.log('\n==== SUMMARY (issue = API diverges from "expected" invariant) ====')
for (const [l, p, d] of results) console.log(`${p ? '[expected]' : '[ISSUE]   '} ${l}`)
