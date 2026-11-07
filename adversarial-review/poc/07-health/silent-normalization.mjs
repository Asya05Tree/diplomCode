// §3/§6/§9: silent invariant downgrades.
// (a) AddCondition Relation accepts junk -> silently becomes "Avoid" (no 400).
// (b) affectsFood=true but no tag -> silently AffectsFood=false (user thinks filter is set).
// (c) PutRestriction Relation IS validated (400) -> contrast. (d) invalid medicine State -> 404 (should be 400).
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t07.norm@gmail.com' })

// (a) junk relation
const a = await api('POST', '/api/medicine-cabinet/conditions', { token: u.token,
  body: { nameUk: 'junk-relation', affectsFood: false, tag: null, relation: 'Prefer-or-garbage' } })
console.log(`(a) relation="Prefer-or-garbage" -> ${a.status}, stored relation="${a.json?.relation}" (expected 400 or honored; got silent Avoid)`)

// (b) affectsFood true, no tag
const b = await api('POST', '/api/medicine-cabinet/conditions', { token: u.token,
  body: { nameUk: 'food-no-tag', affectsFood: true, tag: null, relation: 'Avoid' } })
console.log(`(b) affectsFood=true, tag=null -> ${b.status}, affectsFood stored=${b.json?.affectsFood} (expected warning; got silent false)`)

// (c) restriction with bad relation -> should be 400
const c = await api('PUT', '/api/health-profile/restrictions', { token: u.token, body: { tagKey: 'gluten', relation: 'Nonsense', weight: null } })
console.log(`(c) PUT restriction relation="Nonsense" -> ${c.status} ${c.text} (this path DOES validate => 400)`)

// (d) invalid cabinet state -> wrong status code (404 instead of 400)
await api('POST', '/api/medicine-cabinet/2058', { token: u.token })
const d = await api('PUT', '/api/medicine-cabinet/2058', { token: u.token, body: { state: 'Exploded', expiresAt: null } })
console.log(`(d) PUT state="Exploded" on owned med -> ${d.status} (expected 400 Bad Request; got ${d.status})`)

console.log('---')
if (a.status === 200 && a.json?.relation === 'Avoid') console.log('CONFIRMED (a): junk Relation silently coerced to "Avoid", HTTP 200 (MedicineService.cs:280).')
if (b.status === 200 && b.json?.affectsFood === false) console.log('CONFIRMED (b): affectsFood requested true but stored false with no warning (MedicineService.cs:327).')
if (d.status === 404) console.log('CONFIRMED (d): invalid State -> 404 NotFound instead of 400 (MedicineService.UpdateCabinetAsync returns false => controller 404, MedicineCabinetController.cs:52).')
