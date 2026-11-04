// Фіксований набір категорій для списку покупок (двомовний). Ключ зберігається у
// ShoppingItem.Category на бекенді (вільний рядок), назва показується мовою інтерфейсу.
// Раніше категорія була вільним хештегом — тепер це вибір зі списку реальних категорій,
// але старі (довільні) значення лишаються читабельними завдяки fallback у categoryName.
const DEFS = [
  ['produce', 'Овочі та фрукти', 'Fruits & vegetables'],
  ['meat_fish', "М'ясо та риба", 'Meat & fish'],
  ['dairy', 'Молочне та яйця', 'Dairy & eggs'],
  ['bakery', 'Хліб та випічка', 'Bread & bakery'],
  ['grocery', 'Бакалія (крупи, макарони)', 'Grocery staples'],
  ['drinks', 'Напої', 'Drinks'],
  ['frozen', 'Заморожене', 'Frozen'],
  ['sweets', 'Снеки та солодощі', 'Snacks & sweets'],
  ['condiments', 'Соуси та спеції', 'Sauces & spices'],
  ['medicine', 'Ліки', 'Medicine'],
  ['hygiene', 'Гігієна та косметика', 'Hygiene & cosmetics'],
  ['household', 'Побутова хімія', 'Household chemicals'],
  ['home', 'Товари для дому', 'Home goods'],
  ['stationery', 'Канцтовари', 'Stationery'],
  ['pets', 'Для тварин', 'Pet supplies'],
  ['other', 'Інше', 'Other'],
]

export const SHOPPING_CATEGORIES = DEFS.map(([key, uk, en]) => ({ key, uk, en }))

const BY_KEY = new Map(SHOPPING_CATEGORIES.map((c) => [c.key, c]))

// Локалізована назва категорії за ключем; невідомий ключ показуємо як є (старі довільні дані).
export function shoppingCategoryName(key, language) {
  if (!key) return ''
  const c = BY_KEY.get(key)
  if (!c) return key
  return language === 'en' ? c.en : c.uk
}
