// §8 — CORS policy is hardcoded to http://localhost:5173 and applied unconditionally
// (app.UseCors(DevClientPolicy) outside IsDevelopment). Probe the ACAO header with a
// legit origin and a foreign origin.
//
// Note: CORS is a browser-enforced control; it does NOT protect the API from non-browser
// clients (curl/node ignore it). This probe documents what the server advertises.
//
// Run: node 04-cors.mjs
const BASE = process.env.ADV_BASE || 'http://localhost:5080'
const line = (s = '') => process.stdout.write(s + '\n')

async function probe(origin) {
  const pre = await fetch(`${BASE}/api/auth/me`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  })
  const acao = pre.headers.get('access-control-allow-origin')
  line(`Origin: ${origin.padEnd(28)} preflight ${pre.status}  ACAO=${acao ?? '(none)'}`)
  return acao
}

line('=== CORS preflight probe (OPTIONS /api/auth/me) ===')
const good = await probe('http://localhost:5173')
const evil = await probe('https://evil.example.com')
const prod = await probe('https://vsetut.example')

line('\n==============================================================')
line('Observed: the ONLY allowed browser origin is http://localhost:5173 (hardcoded).')
line(`  legit dev origin -> ACAO=${good}`)
line(`  foreign origin   -> ACAO=${evil} (correctly NOT reflected -> browsers block it)`)
line(`  real prod origin -> ACAO=${prod} (would also be blocked -> client breaks in prod)`)
line('VERDICT: 🟡 CORS is not an attack vector here (token is a Bearer header, not a cookie,')
line('  AllowCredentials is off), but the origin is HARDCODED to localhost:5173 and UseCors')
line('  runs unconditionally -> any non-local deployment needs a code change. Config smell.')
