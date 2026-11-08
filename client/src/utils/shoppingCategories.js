// Категорії та розділи списку покупок (двомовні). Розділ (section) — широка група «де купувати»
// (Продукти/Аптека/…); категорія (category) — точніше (овочі, молочне…). Обидва визначаються
// автоматично за назвою позиції (rule-based, без ШІ), але категорію можна змінити в картці.

// Розділи (широкі групи). Ключ зберігається у ShoppingItem.Section (валідований на бекенді).
const SECTION_DEFS = [
  ['Groceries', 'Продукти', 'Groceries'],
  ['Pharmacy', 'Аптека', 'Pharmacy'],
  ['Cosmetics', 'Косметика та гігієна', 'Cosmetics & hygiene'],
  ['Household', 'Побутова хімія та дім', 'Household'],
  ['Stationery', 'Канцтовари', 'Stationery'],
  ['Pets', 'Для тварин', 'Pet supplies'],
  ['Other', 'Інше', 'Other'],
]
export const SHOPPING_SECTIONS = SECTION_DEFS.map(([key, uk, en]) => ({ key, uk, en }))
const SECTION_BY_KEY = new Map(SHOPPING_SECTIONS.map((s) => [s.key, s]))

export function sectionName(key, language) {
  const s = SECTION_BY_KEY.get(key)
  if (!s) return key
  return language === 'en' ? s.en : s.uk
}

// Категорії: [ключ, uk, en, розділ]
const DEFS = [
  ['produce', 'Овочі та фрукти', 'Fruits & vegetables', 'Groceries'],
  ['meat_fish', "М'ясо та риба", 'Meat & fish', 'Groceries'],
  ['dairy', 'Молочне та яйця', 'Dairy & eggs', 'Groceries'],
  ['bakery', 'Хліб та випічка', 'Bread & bakery', 'Groceries'],
  ['grocery', 'Бакалія (крупи, макарони)', 'Grocery staples', 'Groceries'],
  ['drinks', 'Напої', 'Drinks', 'Groceries'],
  ['frozen', 'Заморожене', 'Frozen', 'Groceries'],
  ['sweets', 'Снеки та солодощі', 'Snacks & sweets', 'Groceries'],
  ['condiments', 'Соуси та спеції', 'Sauces & spices', 'Groceries'],
  ['medicine', 'Ліки', 'Medicine', 'Pharmacy'],
  ['hygiene', 'Гігієна та косметика', 'Hygiene & cosmetics', 'Cosmetics'],
  ['household', 'Побутова хімія', 'Household chemicals', 'Household'],
  ['home', 'Товари для дому', 'Home goods', 'Household'],
  ['stationery', 'Канцтовари', 'Stationery', 'Stationery'],
  ['pets', 'Для тварин', 'Pet supplies', 'Pets'],
  ['other', 'Інше', 'Other', 'Other'],
]

export const SHOPPING_CATEGORIES = DEFS.map(([key, uk, en, section]) => ({ key, uk, en, section }))
const BY_KEY = new Map(SHOPPING_CATEGORIES.map((c) => [c.key, c]))

// Локалізована назва категорії за ключем; невідомий ключ показуємо як є (старі довільні дані).
export function shoppingCategoryName(key, language) {
  if (!key) return ''
  const c = BY_KEY.get(key)
  if (!c) return key
  return language === 'en' ? c.en : c.uk
}

// Розділ для категорії (щоб визначати section автоматично разом із категорією).
export function sectionForCategory(categoryKey) {
  return BY_KEY.get(categoryKey)?.section ?? 'Other'
}

// Ключові слова → категорія (uk/en, нижній регістр, підрядок). Порядок = пріоритет (специфічні вище).
const KEYWORDS = [
  ['medicine', ['таблетк', 'ліки', 'лікарськ', 'сироп', 'мазь', 'бинт', 'пластир', 'вітамін', 'парацетамол', 'ібупрофен', 'аспірин', 'спрей', 'краплі', 'антисептик', 'градусник', 'шприц', 'pill', 'medicine', 'vitamin', 'bandage', 'syrup']],
  ['hygiene', ['шампун', 'мило', 'зубн', 'зубна паст', 'гель для душу', 'дезодорант', 'крем', 'серветк', 'памперс', 'підгузк', 'прокладк', 'бритв', 'ватн', 'тампон', 'shampoo', 'soap', 'toothpaste', 'deodorant', 'wipe', 'razor', 'diaper']],
  ['household', ['порошок', 'пральн', 'засіб', 'чист', 'мийн', 'губк', 'пакет', 'сміттєв', 'освіжувач', 'рукавичк', 'відбілювач', 'мішк', 'detergent', 'cleaner', 'sponge', 'trash', 'bleach']],
  ['stationery', ['ручк', 'олівец', 'зошит', 'папір', 'блокнот', 'маркер', 'клей', 'ножиц', 'скотч', 'файл', 'pen', 'pencil', 'notebook', 'paper', 'marker', 'glue']],
  ['pets', ['корм', 'котяч', 'собач', 'наповнювач', 'pet', 'cat food', 'dog food', 'litter']],
  ['dairy', ['молок', 'молочн', 'сир', 'творог', 'кефір', 'йогурт', 'сметан', 'масло', 'вершк', 'яйц', 'milk', 'cheese', 'yogurt', 'butter', 'egg', 'cream']],
  ['meat_fish', ["м'яс", 'мяс', 'курк', 'куряч', 'свинин', 'яловичин', 'фарш', 'ковбас', 'сосиск', 'риб', 'лосос', 'тунец', 'креветк', 'філе', 'бекон', 'шинк', 'meat', 'chicken', 'beef', 'pork', 'fish', 'sausage', 'shrimp', 'bacon']],
  ['bakery', ['хліб', 'булк', 'батон', 'лаваш', 'випічк', 'круасан', 'багет', 'bread', 'bun', 'pastry', 'croissant', 'baguette']],
  ['frozen', ['заморож', 'морозиво', 'пельмен', 'вареник', 'frozen', 'ice cream']],
  ['sweets', ['шоколад', 'цукерк', 'печив', 'снек', 'чіпс', 'вафл', 'жувальн', 'мармелад', 'зефір', 'халва', 'chocolate', 'candy', 'chips', 'snack', 'cookie', 'wafer']],
  ['drinks', ['вода', 'сік', 'напій', 'пиво', 'вино', 'кола', 'лимонад', 'мінерал', 'енергетик', 'water', 'juice', 'drink', 'beer', 'wine', 'soda', 'cola']],
  ['condiments', ['соус', 'кетчуп', 'майонез', 'спеці', 'приправ', 'оцет', 'гірчиц', 'аджик', 'sauce', 'ketchup', 'mayo', 'spice', 'vinegar', 'mustard']],
  ['grocery', ['крупа', 'рис', 'гречк', 'макарон', 'паста', 'спагет', 'вермішел', 'борошн', 'цукор', 'сіль', 'олі', 'олія', 'чай', 'кава', 'консерв', 'сода', 'дріжд', 'мед', 'rice', 'pasta', 'spaghetti', 'flour', 'sugar', 'salt', 'oil', 'tea', 'coffee', 'honey', 'cereal']],
  ['produce', ['яблук', 'яблучк', 'банан', 'помідор', 'томат', 'огірк', 'картопл', 'бульб', 'цибул', 'моркв', 'буряк', 'капуст', 'броколі', 'цвітн', 'салат', 'лимон', 'лайм', 'апельсин', 'мандарин', 'грейпфрут', 'груш', 'виноград', 'перец', 'перч', 'часник', 'зелен', 'зелень', 'петрушк', 'кріп', 'шпинат', 'селер', 'ягод', 'полуниц', 'суниц', 'малин', 'ожин', 'смородин', 'чорниц', 'лохин', 'журавлин', 'вишн', 'черешн', 'слив', 'абрикос', 'персик', 'нектарин', 'ківі', 'манго', 'ананас', 'хурм', 'гранат', 'інжир', 'кавун', 'диня', 'гарбуз', 'кабач', 'баклажан', 'редис', 'редьк', 'ріп', 'кукурудз', 'квасол', 'горох', 'нут', 'сочевиц', 'гриб', 'печериц', 'глив', 'імбир', 'авокадо', 'фрукт', 'овоч', 'apple', 'banana', 'tomato', 'cucumber', 'potato', 'onion', 'carrot', 'beet', 'cabbage', 'broccoli', 'lettuce', 'fruit', 'vegetable', 'lemon', 'lime', 'orange', 'mandarin', 'grape', 'pepper', 'garlic', 'mushroom', 'pumpkin', 'zucchini', 'eggplant', 'avocado', 'mango', 'pineapple', 'pear', 'peach', 'plum', 'apricot', 'corn', 'bean', 'pea', 'lentil', 'spinach', 'ginger', 'berry', 'strawberr', 'raspberr', 'blueberr']],
  ['home', ['лампочк', 'батарейк', 'посуд', 'чайник', 'каструл', 'сковор', 'рушник', 'свічк', 'bulb', 'battery', 'towel', 'candle', 'kettle']],
]

// Зводимо різні варіанти апострофа (U+0027 ' , U+2019 ' , U+02BC ʼ , U+2032 ′ , ` , ´) до одного,
// щоб "мʼясо"/"м'ясо"/"м`ясо" однаково матчились на ключ "м'яс" (ПЛАН P2-9).
function normalizeName(name) {
  return (name || '').toLowerCase().replace(/[’ʼ′`´]/g, "'")
}

// Вгадати категорію за назвою; якщо нічого не знайдено — 'other'. Виграє НАЙДОВШИЙ збіг-підрядок
// (специфічніший), а не просто перша категорія за порядком: інакше коротке 'чай' у «чайник»
// перемагало б точніше 'чайник', а 'паст' у «паста» — 'макарон'. При рівній довжині виграє та
// категорія, що вище в списку (ПЛАН P2-9).
export function guessShoppingCategory(name) {
  const n = normalizeName(name)
  if (!n.trim()) return 'other'
  let best = 'other'
  let bestLen = 0
  for (const [cat, words] of KEYWORDS) {
    for (const w of words) {
      if (w.length > bestLen && n.includes(w)) {
        best = cat
        bestLen = w.length
      }
    }
  }
  return best
}

// Українська абетка (малі літери) + апостроф. Словники й ввід мають бути українською або
// англійською (латиниця) — російської в словниках немає взагалі. Якщо у вводі є кирилична
// літера ПОЗА українською абеткою (рос. ё/ъ/ы/э, білор. ў, каз. ә/ғ/қ/ң/… тощо) — це ознака,
// що введено не українською, і ми мʼяко просимо ввести українською. Латиницю не чіпаємо.
const UK_LETTERS = new Set("абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'".split(''))
export function hasNonUkrainianCyrillic(text) {
  for (const ch of normalizeName(text)) {
    // кириличний блок Unicode, але не українська літера → чужомовна
    if (ch >= 'Ѐ' && ch <= 'ӿ' && !UK_LETTERS.has(ch)) return true
  }
  return false
}
