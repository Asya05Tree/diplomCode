// Фіксований набір категорій фінансів (двомовний + колір-маркер). Ключ зберігається у
// FinanceTransaction.Category на бекенді; назва показується мовою інтерфейсу. Кольори —
// циклічно з палітри макета фінансів (mockups/finance-variants/shared.css, --cat-color-1..8).
const PALETTE = ['#ffd9b3', '#c9ead3', '#b3e5fc', '#c5cae9', '#f8bbd0', '#ffe8b8', '#d1c4e9', '#e0e0e0']

const DEFS = [
  ['food', 'Їжа', 'Food'],
  ['housing', 'Житло (оренда/іпотека)', 'Housing (rent/mortgage)'],
  ['utilities', 'Комунальні послуги', 'Utilities'],
  ['communication', "Зв'язок та інтернет", 'Phone & internet'],
  ['transport', 'Транспорт (громадський)', 'Transport (public)'],
  ['car', 'Автомобіль (базове)', 'Car (basic)'],
  ['health', "Здоров'я (базове)", 'Health (basic)'],
  ['household', 'Побутова хімія та гігієна', 'Household & hygiene'],
  ['clothing', 'Одяг та взуття', 'Clothing & shoes'],
  ['entertainment', 'Розваги та дозвілля', 'Entertainment'],
  ['dining', 'Кафе та ресторани', 'Cafes & restaurants'],
  ['hobbies', 'Хобі та захоплення', 'Hobbies'],
  ['beauty', 'Краса та догляд', 'Beauty & care'],
  ['sport', 'Спорт та фітнес', 'Sport & fitness'],
  ['subscriptions', 'Підписки', 'Subscriptions'],
  ['shopping', 'Шопінг та ґаджети', 'Shopping & gadgets'],
  ['pocket', 'Кишенькові / спонтанні', 'Pocket / impulse'],
  ['travel', 'Подорожі та відпустка', 'Travel & vacation'],
  ['car_repair', 'Автомобіль (сезон/ремонт)', 'Car (seasonal/repair)'],
  ['taxes', 'Податки та збори', 'Taxes & fees'],
  ['gifts', 'Свята та подарунки', 'Holidays & gifts'],
  ['home_big', 'Великі покупки для дому', 'Big home purchases'],
  ['education', 'Навчання та саморозвиток', 'Education & self-growth'],
  ['medical', 'Медицина (непередбачена)', 'Medical (unexpected)'],
  ['renovation', 'Ремонт', 'Renovation'],
  ['kids', 'Діти', 'Kids'],
  ['pets', 'Домашні тварини', 'Pets'],
  ['loans', 'Кредити та борги', 'Loans & debts'],
  ['savings', 'Заощадження та подушка', 'Savings & cushion'],
  ['investments', 'Інвестиції', 'Investments'],
  ['insurance', 'Страхування', 'Insurance'],
  ['charity', 'Благодійність', 'Charity'],
  ['family_help', 'Допомога рідним', 'Family support'],
]

export const FINANCE_CATEGORIES = DEFS.map(([key, uk, en], i) => ({
  key,
  uk,
  en,
  color: PALETTE[i % PALETTE.length],
}))

const BY_KEY = new Map(FINANCE_CATEGORIES.map((c) => [c.key, c]))

// Локалізована назва категорії за ключем; невідомий ключ показуємо як є (на випадок старих даних).
export function categoryName(key, language) {
  const c = BY_KEY.get(key)
  if (!c) return key
  return language === 'en' ? c.en : c.uk
}
