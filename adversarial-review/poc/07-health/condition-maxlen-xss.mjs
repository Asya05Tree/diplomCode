// §6/§8/§10: condition NameUk and allergen Tag.Key have no server-side length/charset limits.
// Direct API writes arbitrarily long diagnosis names & tag keys (client MAX_LEN=60 is UX only).
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'
const q = (sql) => execFileSync('docker', ['exec','planner-mysql','mysql','-N','-uplanner','-pplanner_dev_password','planner','-e',sql], { encoding:'utf8' }).trim()

const u = await provision({ email: 'adv.t07.cond@gmail.com' })

const bigName = '<b>diag</b>' + 'я'.repeat(4000)
const bigTag = 'spamkey' + 'z'.repeat(2000)
const r = await api('POST', '/api/medicine-cabinet/conditions', { token: u.token,
  body: { nameUk: bigName, affectsFood: true, tag: bigTag, relation: 'Avoid' } })
console.log(`[POST condition 4KB name + 2KB tag] -> ${r.status} tagKnown=${r.json?.tagKnown}`)

const dbName = q(`SELECT LENGTH(NameUk) FROM UserConditions WHERE UserId=${u.userId} ORDER BY Id DESC LIMIT 1;`)
const dbTag = q(`SELECT LENGTH(\`Key\`) FROM Tags WHERE Namespace='allergen' ORDER BY Id DESC LIMIT 1;`)
console.log(`[DB] UserConditions.NameUk bytes=${dbName}  newest allergen Tag.Key chars/bytes=${dbTag}`)

console.log('---')
if (Number(dbName) > 100) console.log('CONFIRMED: UserCondition.NameUk has no server MAX_LEN — full oversized diagnosis stored (MedicineService.cs:325; no [MaxLength] on model). HTML stored verbatim (React escapes on render, but no sanitization).')
if (Number(dbTag) > 100) console.log('CONFIRMED: allergen Tag.Key unbounded — attacker spams global Tags table with giant keys (MedicineService.cs:303).')
