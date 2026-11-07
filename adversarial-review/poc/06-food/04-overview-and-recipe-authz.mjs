// §7 🟠 / §6 🟡 / §10 🟡 Server does NOT filter forbidden recipes; overview ships full Steps;
// toggleSelected & markCooked accept ANY valid recipeId (incl. forbidden), no "was it cooked" check.
//
// GetOverviewAsync (RecipeService.cs:42-117) returns every recipe with computed health + Steps.
// visibleRecipes forbidden-hide (Food.jsx:140) is CLIENT-ONLY.
// ToggleSelectedAsync/MarkCookedAsync (RecipeService.cs:183-213) only check Recipes.AnyAsync(Id).
//
// Run: node 04-overview-and-recipe-authz.mjs
import { provision, api } from '../_lib/provision.mjs'

const U = await provision({ email: 'adv.t06.health@gmail.com' })

const ov = (await api('GET', '/api/food/overview', { token: U.token })).json
console.log(`overview: ${ov.recipes.length} recipes, each with Steps shipped. Sample recipe steps=${ov.recipes[0].steps.length}`)
const stepsTotal = ov.recipes.reduce((s, r) => s + r.steps.length, 0)
console.log(`Total recipe steps in payload = ${stepsTotal} (client never renders steps -> dead weight)`)

// Force a Forbidden restriction on tags aggregated by recipes, so at least one recipe is forbidden.
for (const tag of ['dairy', 'gluten', 'meat', 'egg', 'vegetable', 'sugar', 'salt']) {
  await api('PUT', '/api/health-profile/restrictions', { token: U.token, body: { tagKey: tag, relation: 'Forbidden', weight: null } })
}
const ov2 = (await api('GET', '/api/food/overview', { token: U.token })).json
const forbidden = ov2.recipes.filter((r) => r.health?.forbidden)
console.log(`\nAfter setting Forbidden on common tags: ${forbidden.length}/${ov2.recipes.length} recipes are health.forbidden`)
if (forbidden.length) {
  const f = forbidden[0]
  console.log(`  Forbidden recipe STILL in overview: id=${f.id} "${f.nameUk}" forbidden-tag=${f.health.forbidden} ingredients=${f.ingredients.length} steps=${f.steps.length}`)

  // Server lets us SELECT and mark-cooked a forbidden recipe.
  const sel = await api('POST', `/api/food/selected/${f.id}`, { token: U.token })
  const cook = await api('POST', `/api/food/recipes/${f.id}/cooked`, { token: U.token })
  console.log(`  POST selected/${f.id} -> HTTP ${sel.status}; POST recipes/${f.id}/cooked -> HTTP ${cook.status} (both 200 = no server-side forbidden guard)`)

  const confirmed = f.health.forbidden && sel.status === 200 && cook.status === 200
  console.log('\n' + (confirmed
    ? `CONFIRMED: forbidden filtering is client-only. Observed: overview returns forbidden recipe ${f.id} with full ingredients+steps; server accepts select (${sel.status}) & cooked (${cook.status}) on it. Expected: server to omit/deny forbidden recipes (spec §2.3/§4.6).`
    : 'NOT CONFIRMED'))
} else {
  console.log('NOT CONFIRMED (no recipe became forbidden — tag mapping differs)')
}

// markCooked on a never-selected recipe
const anyId = ov.recipes[0].id
const cookUnselected = await api('POST', `/api/food/recipes/${anyId}/cooked`, { token: U.token })
console.log(`\nSECONDARY: markCooked on never-selected recipe ${anyId} -> HTTP ${cookUnselected.status} (no "was selected/cooked" precondition).`)
