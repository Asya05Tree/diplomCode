// §8 / §3 — Server does NOT limit Title/Description length (only IsNullOrWhiteSpace).
// Combined with no maxLength on the client title field → unbounded strings persisted.
import { provision, api } from '../_lib/provision.mjs'

const A = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })
const today = new Date().toISOString().slice(0, 10)

const bigTitle = 'A'.repeat(200000)      // 200k chars
const bigDesc = 'B'.repeat(500000)       // 500k chars
const res = await api('POST', '/api/tasks', { token: A.token, body: {
  Title: bigTitle, Description: bigDesc, StartDateTime: `${today}T09:00:00` }})
console.log('create 200k-title / 500k-desc task ->', res.status)
const id = res.json?.Id ?? res.json?.id

// read back length
const list = await api('GET', `/api/tasks/period?from=${today}&to=${today}`, { token: A.token })
const t = (list.json || []).find(x => (x.Id ?? x.id) === id)
const titleLen = (t?.Title ?? t?.title ?? '').length
const descLen = (t?.Description ?? t?.description ?? '').length
console.log('read-back title length =', titleLen, ' description length =', descLen)

if (id) await api('DELETE', `/api/tasks/${id}`, { token: A.token })

const confirmed = res.status === 200 && titleLen >= 200000
console.log('\n' + (confirmed
  ? `CONFIRMED — 200k-char title stored unchanged (expected: 400 or length cap, e.g. ≤256). ` +
    `Resource amplification / response bloat.`
  : `REFUTED — status=${res.status}, titleLen=${titleLen}`))
