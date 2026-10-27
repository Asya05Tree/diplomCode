// Шар доступу до псевдо-БД їжі (див. README.md у цій папці). Довідники продуктів і
// рецептів — статичний JSON (майбутні таблиці Product/Recipe), а користувацький стан
// (запаси StockItem, обрані страви SelectedDish, LastCookedAt) живе в localStorage,
// за тим самим принципом, що й utils/finance.js та utils/cycle.js. Коли зʼявиться
// бекенд їжі, достатньо замінити тіла функцій на виклики API — сторінка Food.jsx
// працює лише через цей модуль і не знає про localStorage.
import PRODUCTS from './products.json'
import RECIPES from './recipes.json'
import HEALTH from './health.json'

const STOCK_KEY = 'food:stock' // { productId: 'Available' | 'RunningLow' | 'OutOfStock' }
const SELECTED_KEY = 'food:selected' // [recipeId]
const LAST_COOKED_KEY = 'food:lastCooked' // { recipeId: ISO-рядок }

const RULES_KEY = 'health:rules' // { tagKey: { relation: 'Forbidden' | 'Avoid', enabled: bool } }
const MED_STATE_KEY = 'health:medicineState' // { medicineId: 'Available' | 'RunningLow' | 'OutOfStock' }
const MED_ADDED_KEY = 'health:medicineAdded' // [medicineId] — додані з довідника
const CONDITIONS_ADDED_KEY = 'health:conditionsAdded' // [condition] — додані користувачем хвороби

export { PRODUCTS, RECIPES }
export const MEDICINE_CATEGORIES = HEALTH.categories
export const MEDICINES = HEALTH.medicines
export const ADDABLE_MEDICINES = HEALTH.addableMedicines
export const CONDITIONS = HEALTH.conditions

// StockItem.State (planner-spec.md §3.4). "OutOfStock" прибирає продукт зі списку запасів
// і робить рецепт з ним таким, що потребує докупівлі.
export const STOCK_STATES = ['Available', 'RunningLow', 'OutOfStock']

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id) ?? null
}

// Довідникові назви двомовні (NameUk/NameEn, coding-guide.md §3) — мову обирає компонент.
export function productName(product, language) {
  if (!product) return ''
  return language === 'en' ? product.nameEn : product.nameUk
}

export function recipeName(recipe, language) {
  return language === 'en' ? recipe.nameEn : recipe.nameUk
}

export function ingredientAmount(ingredient, language) {
  return language === 'en' ? ingredient.amountEn : ingredient.amountUk
}

export function stepText(step, language) {
  return language === 'en' ? step.en : step.uk
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

// ---- Запаси (StockItem) ----------------------------------------------------

// Початковий стан для нового користувача — із сідера (products.stocked=true).
function seedStock() {
  const map = {}
  for (const p of PRODUCTS) {
    if (p.stocked) map[p.id] = p.seedState ?? 'Available'
  }
  return map
}

export function getStockMap() {
  const raw = localStorage.getItem(STOCK_KEY)
  if (!raw) {
    const seeded = seedStock()
    localStorage.setItem(STOCK_KEY, JSON.stringify(seeded))
    return seeded
  }
  try {
    return JSON.parse(raw)
  } catch {
    return seedStock()
  }
}

function saveStockMap(map) {
  localStorage.setItem(STOCK_KEY, JSON.stringify(map))
}

export function setStockState(productId, state) {
  const map = getStockMap()
  map[productId] = state
  saveStockMap(map)
  return map
}

export function addStockProduct(productId) {
  return setStockState(productId, 'Available')
}

// "Є" і "закінчується" — продукт у наявності; "немає"/відсутній у мапі — його треба докупити.
export function isPresent(stockMap, productId) {
  const state = stockMap[productId]
  return state === 'Available' || state === 'RunningLow'
}

// Список запасів для показу: OutOfStock приховується (planner-spec.md §4.6, мокап food-variants).
export function listStock(stockMap) {
  return PRODUCTS.filter((p) => stockMap[p.id] && stockMap[p.id] !== 'OutOfStock').map((p) => ({
    product: p,
    state: stockMap[p.id],
  }))
}

// Продукти, яких немає в запасах — для панелі "Додати запаси".
export function listAddableProducts(stockMap) {
  return PRODUCTS.filter((p) => !stockMap[p.id] || stockMap[p.id] === 'OutOfStock')
}

// ---- Наявність інгредієнтів рецепта ----------------------------------------

// Повертає чого бракує для рецепта й у скільки обійдеться докупівля (сума орієнтовних цін).
// Систему грамовок не цікавить (AmountText лише довідковий, §3.4) — рахуємо саме нестачу продуктів.
export function computeAvailability(recipe, stockMap) {
  const missingProducts = recipe.ingredients
    .filter((ing) => !isPresent(stockMap, ing.productId))
    .map((ing) => getProduct(ing.productId))
    .filter(Boolean)
  const missingCost = missingProducts.reduce((sum, p) => sum + (p.price || 0), 0)
  return {
    missingProducts,
    missingCount: missingProducts.length,
    missingCost,
    isAvailable: missingProducts.length === 0,
  }
}

// ---- Обрані страви (SelectedDish) ------------------------------------------

export function getSelected() {
  return readJson(SELECTED_KEY, [])
}

export function isSelected(recipeId) {
  return getSelected().includes(recipeId)
}

export function toggleSelected(recipeId) {
  const current = getSelected()
  const next = current.includes(recipeId)
    ? current.filter((id) => id !== recipeId)
    : [...current, recipeId]
  localStorage.setItem(SELECTED_KEY, JSON.stringify(next))
  return next
}

export function removeSelected(recipeId) {
  const next = getSelected().filter((id) => id !== recipeId)
  localStorage.setItem(SELECTED_KEY, JSON.stringify(next))
  return next
}

// ---- LastCookedAt (Recipe.LastCookedAt, §3.4) ------------------------------

export function getLastCooked() {
  return readJson(LAST_COOKED_KEY, {})
}

export function markCooked(recipeId) {
  const map = getLastCooked()
  // Дата формується в момент дії користувача (не під час рендеру) — тут це безпечно.
  map[recipeId] = new Date().toISOString()
  localStorage.setItem(LAST_COOKED_KEY, JSON.stringify(map))
  return map
}

// ============================================================================
// Здоровʼя (planner-spec.md §3.5 Аптечка, §3.1/§11 хронічні захворювання)
// ============================================================================

export function medName(medicine, language) {
  return language === 'en' ? medicine.nameEn : medicine.nameUk
}

export function medSubstance(medicine, language) {
  return language === 'en' ? medicine.substanceEn : medicine.substanceUk
}

export function medConflicts(medicine, language) {
  return (language === 'en' ? medicine.conflictsEn : medicine.conflictsUk) || []
}

export function categoryName(key, language) {
  const c = MEDICINE_CATEGORIES.find((x) => x.key === key)
  if (!c) return key
  return language === 'en' ? c.nameEn : c.nameUk
}

export function conditionName(condition, language) {
  return language === 'en' ? condition.nameEn : condition.nameUk
}

export function conditionTag(condition, language) {
  return language === 'en' ? condition.tagEn : condition.tagUk
}

// Назва тега-обмеження для показу в "Їжі" (бере підпис із відповідного захворювання).
// Шукає серед базових І доданих користувачем захворювань.
export function tagLabel(tagKey, language) {
  const c = listConditions().find((x) => x.tagKey === tagKey)
  if (!c) return tagKey
  return language === 'en' ? c.tagEn : c.tagUk
}

// ---- Аптечка (UserMedicine.State) ------------------------------------------

function seedMedicineState() {
  const map = {}
  for (const m of MEDICINES) map[m.id] = m.seedState
  return map
}

export function getMedicineState() {
  const raw = localStorage.getItem(MED_STATE_KEY)
  if (!raw) {
    const seeded = seedMedicineState()
    localStorage.setItem(MED_STATE_KEY, JSON.stringify(seeded))
    return seeded
  }
  try {
    return JSON.parse(raw)
  } catch {
    return seedMedicineState()
  }
}

export function setMedicineState(id, state) {
  const map = getMedicineState()
  map[id] = state
  localStorage.setItem(MED_STATE_KEY, JSON.stringify(map))
  return map
}

function getAddedMedicineIds() {
  return readJson(MED_ADDED_KEY, [])
}

export function addMedicine(id) {
  const added = getAddedMedicineIds()
  if (!added.includes(id)) localStorage.setItem(MED_ADDED_KEY, JSON.stringify([...added, id]))
  return setMedicineState(id, 'Available')
}

// Повний список препаратів аптечки: базові з довідника + додані користувачем, з поточним станом.
export function listMedicines() {
  const state = getMedicineState()
  const added = getAddedMedicineIds()
  const base = MEDICINES.map((m) => ({ ...m, state: state[m.id] ?? m.seedState }))
  const extra = added
    .map((id) => ADDABLE_MEDICINES.find((m) => m.id === id))
    .filter(Boolean)
    .map((m) => ({ ...m, state: state[m.id] ?? 'Available' }))
  return [...base, ...extra]
}

export function listAddableMedicines() {
  const added = getAddedMedicineIds()
  return ADDABLE_MEDICINES.filter((m) => !added.includes(m.id))
}

// ---- Правила харчування з хронічних захворювань ----------------------------
// Головне архітектурне рішення (§2.3): обмеження зберігаються як ДАНІ, а не як if у коді.
// Хвороба, що впливає на їжу, стає правилом на тег: Forbidden (жорстке — страви з тегом
// не показуються) або Avoid (мʼяке — лише попередження). Цей самий стор читає модуль "Їжа".

function seedRules() {
  const map = {}
  for (const c of CONDITIONS) {
    if (c.affectsFood && c.tagKey) map[c.tagKey] = { relation: c.defaultRelation, enabled: true }
  }
  return map
}

export function getRules() {
  const raw = localStorage.getItem(RULES_KEY)
  if (!raw) {
    const seeded = seedRules()
    localStorage.setItem(RULES_KEY, JSON.stringify(seeded))
    return seeded
  }
  try {
    return JSON.parse(raw)
  } catch {
    return seedRules()
  }
}

// Записати/змінити правило для тега (relation + увімкнено). null — прибрати правило зовсім.
export function setRule(tagKey, rule) {
  const map = getRules()
  if (rule === null) delete map[tagKey]
  else map[tagKey] = rule
  localStorage.setItem(RULES_KEY, JSON.stringify(map))
  return map
}

// ---- Додані користувачем захворювання --------------------------------------
// Довідник CONDITIONS статичний (майбутня таблиця), але користувач може додати власне
// захворювання. Якщо воно впливає на їжу — одразу стає правилом на введений тег, і далі
// працює так само, як базові (через той самий стор rules, §2.3 "обмеження як дані").

function getAddedConditions() {
  return readJson(CONDITIONS_ADDED_KEY, [])
}

// Повний список хронічних захворювань: базові з довідника + додані користувачем.
export function listConditions() {
  return [...CONDITIONS, ...getAddedConditions()]
}

export function addCondition({ name, affectsFood, tag, relation }) {
  const trimmed = (name || '').trim()
  if (!trimmed) return getAddedConditions()
  const tagText = (tag || '').trim()
  // Тег = ключ правила у нижньому регістрі (щоб збігався з product.tags на кшталт "lactose").
  const tagKey = affectsFood && tagText ? tagText.toLowerCase() : null
  const condition = {
    id: `cond-${Date.now()}`,
    nameUk: trimmed,
    nameEn: trimmed,
    affectsFood: !!(affectsFood && tagKey),
    tagKey,
    tagUk: tagText,
    tagEn: tagText,
    defaultRelation: relation === 'Forbidden' ? 'Forbidden' : 'Avoid',
    custom: true,
  }
  const next = [...getAddedConditions(), condition]
  localStorage.setItem(CONDITIONS_ADDED_KEY, JSON.stringify(next))
  if (condition.affectsFood) setRule(tagKey, { relation: condition.defaultRelation, enabled: true })
  return next
}

// Перетин тегів набору з активними правилами (єдина точка перевірки, §2.3).
function tagsRuleStatus(tags, rules) {
  let forbidden = null
  let avoid = null
  for (const tag of tags) {
    const rule = rules[tag]
    if (!rule || !rule.enabled) continue
    if (rule.relation === 'Forbidden') forbidden = tag
    else if (rule.relation === 'Avoid' && !avoid) avoid = tag
  }
  return { forbidden, avoid }
}

// Статус страви: чи заборонена (жорстке правило на теге інгредієнта) чи небажана (мʼяке).
export function recipeHealthStatus(recipe, rules) {
  const tags = new Set()
  for (const ing of recipe.ingredients) {
    const product = getProduct(ing.productId)
    if (product) for (const tag of product.tags || []) tags.add(tag)
  }
  return tagsRuleStatus([...tags], rules)
}

// Статус одного продукту в запасах — для позначки "можна / небажано / не можна".
export function productHealthStatus(product, rules) {
  return tagsRuleStatus(product.tags || [], rules)
}
