// Шар доступу до псевдо-БД їжі (див. README.md у цій папці). Довідники продуктів і
// рецептів — статичний JSON (майбутні таблиці Product/Recipe), а користувацький стан
// (запаси StockItem, обрані страви SelectedDish, LastCookedAt) живе в localStorage,
// за тим самим принципом, що й utils/finance.js та utils/cycle.js. Коли зʼявиться
// бекенд їжі, достатньо замінити тіла функцій на виклики API — сторінка Food.jsx
// працює лише через цей модуль і не знає про localStorage.
import PRODUCTS from './products.json'
import RECIPES from './recipes.json'

const STOCK_KEY = 'food:stock' // { productId: 'Available' | 'RunningLow' | 'OutOfStock' }
const SELECTED_KEY = 'food:selected' // [recipeId]
const LAST_COOKED_KEY = 'food:lastCooked' // { recipeId: ISO-рядок }

export { PRODUCTS, RECIPES }

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
