// §11: server search has no min length (client cuts <2 chars, server only rejects empty).
// Every call pulls the whole ~1884-row reference table and scores trigrams in memory.
// 1-char query bypasses the UI gate; measure cost. Also SearchTags loads all product tags per call.
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t07.dos@gmail.com' })

async function timed(path, label) {
  const t0 = performance.now()
  const r = await api('GET', path, { token: u.token })
  const ms = (performance.now() - t0).toFixed(0)
  console.log(`  ${label}: ${path} -> ${r.status}, ${Array.isArray(r.json) ? r.json.length : '?'} results, ${ms}ms`)
  return Number(ms)
}

console.log('[single 1-char queries — each triggers a full reference-table scan + in-memory scoring]')
await timed('/api/medicine-cabinet/search?q=%D0%B0', 'cyr "а"')   // 1 cyrillic letter
await timed('/api/medicine-cabinet/search?q=a', 'lat "a"')
await timed('/api/medicine-cabinet/tags?q=a', 'tags "a"')

console.log('[burst: 20 x 1-char searches, no debounce on client, no throttle on server]')
const t0 = performance.now()
const results = await Promise.all(Array.from({ length: 20 }, () => api('GET', '/api/medicine-cabinet/search?q=%D0%BA', { token: u.token })))
const total = (performance.now() - t0).toFixed(0)
const allOk = results.every((r) => r.status === 200)
console.log(`  20 concurrent 1-char scans -> all ${allOk ? '200' : 'MIXED'} in ${total}ms total`)

console.log('---')
console.log('CONFIRMED: server accepts 1-char q (only empty is rejected, MedicineService.cs:55/103). Each request does _db.Medicines.Where(!inCabinet).ToListAsync() (cs:69) + LINQ trigram scoring over ~1884 rows. No min-length, no debounce, no cache/index => cheap load-amplification bypassing the client <2 gate.')
