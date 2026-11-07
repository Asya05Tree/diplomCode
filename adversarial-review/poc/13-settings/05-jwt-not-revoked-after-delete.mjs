// §7/§8 (🟠) — Account deletion does NOT revoke the JWT. The issued token stays valid
// until exp; replaying it after delete still passes [Authorize]. The checklist predicts
// a subsequent PUT /health-profile tries to UPSERT a UserProfile for a now-missing
// UserId → FK failure (500) — a request from a "dead" account still being processed.
//
// Evidence: AccountService.DeleteAccountAsync:81-97 removes the User row but there is no
// token blacklist / token-version; HealthProfileController.UpdateProfile:44-49 upserts.
import { provision, api } from '../_lib/provision.mjs'
import { db } from './_db.mjs'

const u = await provision({ email: 'adv.t13.revoke@gmail.com', gender: 'female' })
const tok = u.token

// 1) delete the account (correct password)
const del = await api('POST', '/api/account/delete', { token: tok, body: { password: 'Passw0rd!' } })
const userRows = db(`SELECT COUNT(*) FROM Users WHERE Id=${u.userId};`)[0][0]
console.log(`1) delete: status=${del.status}  Users row remaining=${userRows} (expected 0)`)

// 2) reuse the SAME token after deletion — it must authenticate (no revocation)
const getProfile = await api('GET', '/api/health-profile', { token: tok })
console.log(`2) GET /health-profile with post-delete token: status=${getProfile.status} (401=revoked, 404=auth-OK-but-no-data → NOT revoked)`)

// 3) GET /account/export after delete → user is null → 404 (handled)
const exp = await api('GET', '/api/account/export', { token: tok })
console.log(`3) GET /account/export post-delete: status=${exp.status} (expected 404 NotFound)`)

// 4) PUT /health-profile replays → upsert for missing UserId → FK violation 500
const put = await api('PUT', '/api/health-profile', { token: tok, body: { gender: 'female' } })
console.log(`4) PUT /health-profile post-delete: status=${put.status} (500 = orphan upsert attempted for dead account)`)

// 5) delete again with same token → user gone. VerifyPasswordAsync runs FIRST and
//    can't find the user → returns false → 400 invalid_credentials (the NotFound/404
//    branch is unreachable because the password gate fails first on a missing user).
const del2 = await api('POST', '/api/account/delete', { token: tok, body: { password: 'Passw0rd!' } })
console.log(`5) delete again: status=${del2.status} error=${del2.json?.error} (400 — VerifyPassword can't find user, 404 branch unreachable)`)

const notRevoked = getProfile.status !== 401 // auth still accepted (404/500/200, not 401)
console.log('\n==== RESULT (§7/§8 🟠) ====')
console.log(`Token still authenticates after account deletion: ${notRevoked ? 'CONFIRMED (BROKEN — no revocation)' : 'REFUTED — got 401'}`)
console.log(`Dead-account request processed (PUT upsert attempt): status=${put.status} ${put.status >= 500 ? 'CONFIRMED (orphan FK path reached)' : ''}`)
console.log(`Re-delete on dead account: status=${del2.status} (auth passes, password gate 400s on missing user)`)
