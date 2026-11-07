// §1/§7 — Endpoint authorization sweep. Hit a representative set of endpoints with
// NO Authorization header and record the status. Expectation for every data endpoint:
// 401 Unauthorized. Anything that answers 200/3xx without a token is public surface.
//
// Only safe/idempotent probes are used for mutating routes (empty/ないbody) — we only
// care about the AUTH gate (401 vs not), not about creating data.
//
// Run: node 02-authz-sweep.mjs
const BASE = process.env.ADV_BASE || 'http://localhost:5080'
const line = (s = '') => process.stdout.write(s + '\n')

// local probe: NO Authorization header, and redirect:'manual' so we don't chase the
// billing/return 302 into the (down) Vite dev server.
async function probe(method, path) {
  try {
    const res = await fetch(`${BASE}${path}`, { method, redirect: 'manual' })
    return res.status
  } catch (e) {
    return `ERR ${e.cause?.code || e.message}`
  }
}

// method, path, note. GETs are read probes; a couple of POSTs included to prove the
// gate fires before any handler logic.
const probes = [
  ['GET', '/api/health', 'health-check (intentionally public)'],
  ['GET', '/api/auth/me', 'current user'],
  ['GET', '/api/tasks/day?date=2026-01-01', 'tasks'],
  ['GET', '/api/tasks/unassigned', 'tasks'],
  ['GET', '/api/finance', 'finance balance/stats'],
  ['GET', '/api/finance/stats', 'finance'],
  ['GET', '/api/cycle', 'menstrual cycle'],
  ['GET', '/api/study/subjects', 'study'],
  ['GET', '/api/work/contacts', 'work contacts (PII)'],
  ['GET', '/api/work/schedule', 'work'],
  ['GET', '/api/notes', 'notes'],
  ['GET', '/api/media', 'watchlist'],
  ['GET', '/api/shopping-list', 'shopping'],
  ['GET', '/api/food/overview', 'food'],
  ['GET', '/api/medicine-cabinet', 'medicine'],
  ['GET', '/api/checkup/visits', 'health visits'],
  ['GET', '/api/health-profile', 'profile'],
  ['GET', '/api/recurrence-rules', 'recurrence'],
  ['GET', '/api/todo', 'todo'],
  ['GET', '/api/quick-add/status', 'billing status'],
  ['GET', '/api/account/export', 'FULL DATA EXPORT'],
  ['POST', '/api/account/delete', 'DELETE ACCOUNT'],
  ['POST', '/api/billing/callback', 'WayForPay serviceUrl (AllowAnonymous)'],
  ['GET', '/api/billing/return?orderReference=x', 'WayForPay returnUrl (AllowAnonymous)'],
  ['GET', '/swagger/index.html', 'Swagger UI'],
  ['GET', '/swagger/v1/swagger.json', 'Swagger spec'],
]

line('method path                                        status  note')
line('------ ------------------------------------------- ------  ----')
const open = []
for (const [method, path, note] of probes) {
  const status = await probe(method, path) // no token
  const gated = status === 401
  const flag = gated ? '    ' : ' !! '
  line(`${flag}${method.padEnd(5)} ${path.padEnd(43)} ${String(status).padEnd(6)} ${note}`)
  if (!gated) open.push({ method, path, status, note })
}

line('\n==============================================================')
line('Reachable WITHOUT a token (status != 401):')
for (const o of open) line(`  ${o.status}  ${o.method} ${o.path}   (${o.note})`)
line('\nExpected-public: /api/health, /api/billing/callback, /api/billing/return,')
line('                 swagger (dev only). Everything else answering != 401 is a leak.')
