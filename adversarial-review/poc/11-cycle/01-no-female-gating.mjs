// TAB 11 — TOP PRIORITY: prove the `female` gate is client-only.
// Provision a MALE account and successfully drive EVERY Cycle endpoint.
// Expected (secure): 403/404 for male. Observed: 200 + real DB mutation.
import { provision, api } from '../_lib/provision.mjs'

const P = (label, { status, json, text }, expectSecure) => {
  console.log(`\n[${label}] -> HTTP ${status}  body=${text?.slice(0, 200) || '(empty)'}`)
  console.log(`   expected-if-gated: ${expectSecure}`)
}

const male = await provision({
  email: 'adv.t11.male@gmail.com', nickname: 'MaleAdv', gender: 'male',
  studentType: null, isWorking: false,
})
console.log('MALE account:', { userId: male.userId, email: male.email })

// 1) GET /api/cycle  (should be blocked for non-female)
const g = await api('GET', '/api/cycle', { token: male.token })
P('GET /api/cycle (male)', g, '403/404 (not female)')

// 2) POST /start  — create a cycle record as a male
const s = await api('POST', '/api/cycle/start', { token: male.token, body: { date: '2026-02-01' } })
P('POST /api/cycle/start (male)', s, '403/404')
const recId = s.json?.id

// 3) POST /end
const e = await api('POST', '/api/cycle/end', { token: male.token, body: { date: '2026-02-05' } })
P('POST /api/cycle/end (male)', e, '403/404')

// 4) POST /records  (explicit record)
const r = await api('POST', '/api/cycle/records', { token: male.token, body: { startDate: '2026-03-10' } })
P('POST /api/cycle/records (male)', r, '403/404')

// 5) PUT /settings  (write medical settings + push to shopping list)
const st = await api('PUT', '/api/cycle/settings', { token: male.token, body: { reduceLoadOnHeavyDays: true, hygieneProduct: 'tampons' } })
P('PUT /api/cycle/settings (male)', st, '403/404')

// 6) GET again — read back the medical data we just wrote
const g2 = await api('GET', '/api/cycle', { token: male.token })
P('GET /api/cycle again (male)', g2, '403/404')
console.log('   records now in male account:', JSON.stringify(g2.json?.records))
console.log('   settings now in male account:', JSON.stringify(g2.json?.settings))
console.log('   forecast:', JSON.stringify(g2.json?.forecast))

// 7) DELETE the record
if (recId) {
  const d = await api('DELETE', `/api/cycle/records/${recId}`, { token: male.token })
  P(`DELETE /api/cycle/records/${recId} (male)`, d, '403/404')
}

const writesSucceeded = g.status === 200 && s.status === 200 && e.status === 200 &&
  r.status === 200 && st.status === 200 && (g2.json?.records?.length ?? 0) > 0

console.log('\n==============================================')
if (writesSucceeded) {
  console.log('CONFIRMED: NO server-side female gating.')
  console.log('  observed: MALE account performed full CRUD on /api/cycle/* (all 200, data persisted)')
  console.log('  expected: non-female account must be denied (403/404) server-side')
} else {
  console.log('REFUTED: server appears to gate by gender')
}
