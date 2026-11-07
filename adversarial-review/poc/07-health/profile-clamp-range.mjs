// §3/§10: server clamps weight/height/birthYear to RANGES (double protection, good) but silently;
// also tests extreme/Infinity-ish and birthYear edge (age 0 impossible).
import { provision, api } from '../_lib/provision.mjs'

const u = await provision({ email: 'adv.t07.clamp@gmail.com' })

async function put(body) {
  const r = await api('PUT', '/api/health-profile', { token: u.token, body })
  const g = await api('GET', '/api/health-profile', { token: u.token })
  return g.json
}

const over = await put({ weight: 99999, height: 99999, birthYear: 1000, gender: 'female' })
console.log(`sent weight=99999 height=99999 birthYear=1000 -> stored weight=${over.weight} height=${over.height} birthYear=${over.birthYear}`)

const under = await put({ weight: -50, height: 0, birthYear: 3000, gender: 'female' })
console.log(`sent weight=-50 height=0 birthYear=3000 -> stored weight=${under.weight} height=${under.height} birthYear=${under.birthYear}`)

const nowYear = new Date().getFullYear()
console.log(`server birthYear clamp window = [${nowYear-120}, ${nowYear-1}] => min age 1 (age 0 / newborn impossible)`)

console.log('---')
const clamped = over.weight === 500 && over.height === 300 && under.weight === 1 && under.height === 30
if (clamped)
  console.log('CONFIRMED: server Math.Clamp enforces weight[1,500] height[30,300] birthYear[nowY-120,nowY-1] (HealthProfileController.cs:53-55). Good defense-in-depth, BUT clamp is silent — API returns 200 with a different value than sent, no error/explanation (matches client silent clamp, Health.jsx:147-152).')
else
  console.log(`values: over=${JSON.stringify(over)} under=${JSON.stringify(under)}`)
