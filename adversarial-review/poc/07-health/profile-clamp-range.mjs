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
console.log(`server birthYear clamp window = [${nowYear-120}, ${nowYear-6}] => min age 6 (сервіс для осіб від 6 років)`)

console.log('---')
// Реалістичні межі (узгоджено з utils/validation.js RANGES та Умовами користування): вага 10–400 кг,
// зріст 90–250 см, вік 6–120 років (birthYear ∈ [nowY-120, nowY-6]).
const clamped = over.weight === 400 && over.height === 250 && over.birthYear === nowYear - 120
  && under.weight === 10 && under.height === 90 && under.birthYear === nowYear - 6
if (clamped)
  console.log('CONFIRMED: server Math.Clamp enforces weight[10,400] height[90,250] birthYear[nowY-120,nowY-6] (HealthProfileController.cs). Good defense-in-depth, BUT clamp is silent — API returns 200 with a different value than sent, no error/explanation (matches client silent clamp, Health.jsx).')
else
  console.log(`values: over=${JSON.stringify(over)} under=${JSON.stringify(under)}`)
