// Список покупок (planner-spec.md §3.8), поки без бекенду — ShoppingItem API ще не реалізоване
// (воно заплановане на Місяць 4, "Еда: ... список покупок"), тому дані живуть у localStorage,
// за тим самим принципом, що й дошка для малювання (coding-guide.md §14).
const STORAGE_KEY = 'shoppingList:items'

export const SHOPPING_CATEGORIES = ['food', 'drinks', 'chemistry', 'stationery', 'other']

// Ключові слова для автовизначення категорії за назвою товару (укр., без урахування регістру).
// Якщо жодне слово не збіглося — категорію обирає користувач вручну.
const CATEGORY_KEYWORDS = {
  food: [
    'банан', 'яблук', 'хліб', 'молок', 'сир', "м'яс", 'картопл', 'цибул', 'моркв', 'яйц', 'риба',
    'курк', 'круп', 'цукор', 'сіль', 'олія', 'масло', 'ковбас', 'йогурт', 'каша', 'борошн',
    'макарон', 'овоч', 'фрукт', 'помідор', 'огірок',
  ],
  drinks: ['вода', 'сік', 'кава', 'чай', 'лимонад', 'пиво', 'вино', 'напій', 'компот', 'кола'],
  chemistry: [
    'порошок', 'мило', 'засіб', 'шампунь', 'гель', 'відбілювач', 'серветк', 'туалетний папір',
    'пральн', 'миюч', 'памперс', 'прокладк', 'зубна паста',
  ],
  stationery: ['ручка', 'зошит', 'олівець', 'папір для друку', 'скотч', 'клей', 'маркер', 'блокнот', 'степлер'],
}

export function detectCategory(name) {
  const lower = name.trim().toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((word) => lower.includes(word))) return category
  }
  return null
}

export function getShoppingItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveShoppingItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function addShoppingItem(name, category, price = 0) {
  const trimmed = name.trim()
  if (!trimmed) return null
  const item = {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name: trimmed,
    category: category ?? detectCategory(trimmed),
    price: Number(price) || 0,
  }
  saveShoppingItems([...getShoppingItems(), item])
  return item
}

export function removeShoppingItem(id) {
  saveShoppingItems(getShoppingItems().filter((item) => item.id !== id))
}

export function setShoppingItemCategory(id, category) {
  saveShoppingItems(getShoppingItems().map((item) => (item.id === id ? { ...item, category } : item)))
}
