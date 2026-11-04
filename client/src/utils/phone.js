// Телефони: нормалізація, визначення країни за кодом (та очікувана кількість цифр) і — для України —
// мобільного оператора. Усе правилами, без ШІ. Номер зберігається в міжнародному форматі E.164
// ("+" + цифри, максимум 15 цифр).

const OPERATORS = [
  { key: 'kyivstar', name: 'Kyivstar', codes: ['067', '068', '096', '097', '098', '077'] },
  { key: 'vodafone', name: 'Vodafone', codes: ['050', '066', '095', '099'] },
  { key: 'lifecell', name: 'lifecell', codes: ['063', '073', '093'] },
]

// Країни: код + очікувана довжина національного номера (NSN). Загальна довжина E.164 = code + NSN ≤ 15.
// Довші коди перевіряємо першими, щоб не плутати (напр. 380 перед 38*). Україна — типова (за умовч.).
const COUNTRIES = [
  { code: '380', iso: 'UA', name: { uk: 'Україна', en: 'Ukraine' }, nsn: [9] },
  { code: '373', iso: 'MD', name: { uk: 'Молдова', en: 'Moldova' }, nsn: [8] },
  { code: '375', iso: 'BY', name: { uk: 'Білорусь', en: 'Belarus' }, nsn: [9] },
  { code: '420', iso: 'CZ', name: { uk: 'Чехія', en: 'Czechia' }, nsn: [9] },
  { code: '421', iso: 'SK', name: { uk: 'Словаччина', en: 'Slovakia' }, nsn: [9] },
  { code: '995', iso: 'GE', name: { uk: 'Грузія', en: 'Georgia' }, nsn: [9] },
  { code: '971', iso: 'AE', name: { uk: 'ОАЕ', en: 'UAE' }, nsn: [9] },
  { code: '351', iso: 'PT', name: { uk: 'Португалія', en: 'Portugal' }, nsn: [9] },
  { code: '44', iso: 'GB', name: { uk: 'Велика Британія', en: 'United Kingdom' }, nsn: [10] },
  { code: '48', iso: 'PL', name: { uk: 'Польща', en: 'Poland' }, nsn: [9] },
  { code: '49', iso: 'DE', name: { uk: 'Німеччина', en: 'Germany' }, nsn: [10, 11] },
  { code: '33', iso: 'FR', name: { uk: 'Франція', en: 'France' }, nsn: [9] },
  { code: '39', iso: 'IT', name: { uk: 'Італія', en: 'Italy' }, nsn: [9, 10] },
  { code: '34', iso: 'ES', name: { uk: 'Іспанія', en: 'Spain' }, nsn: [9] },
  { code: '40', iso: 'RO', name: { uk: 'Румунія', en: 'Romania' }, nsn: [9] },
  { code: '31', iso: 'NL', name: { uk: 'Нідерланди', en: 'Netherlands' }, nsn: [9] },
  { code: '90', iso: 'TR', name: { uk: 'Туреччина', en: 'Turkey' }, nsn: [10] },
  { code: '7', iso: 'RU', name: { uk: 'Росія / Казахстан', en: 'Russia / Kazakhstan' }, nsn: [10] },
  { code: '1', iso: 'US', name: { uk: 'США / Канада', en: 'USA / Canada' }, nsn: [10] },
].sort((a, b) => b.code.length - a.code.length)

// Лишаємо самі цифри й приводимо +380…/380…/80… до вигляду 0XXXXXXXXX (укр. національний) — для оператора.
export function phoneDigits(raw) {
  let d = (raw || '').replace(/\D/g, '')
  if (d.startsWith('380')) d = '0' + d.slice(3)
  else if (d.startsWith('80') && d.length === 11) d = '0' + d.slice(2)
  return d
}

// Ключ оператора за номером ('kyivstar' | 'vodafone' | 'lifecell' | 'other'), або null якщо порожньо.
export function phoneOperator(raw) {
  const d = phoneDigits(raw)
  if (d.length < 3) return null
  const code = d.slice(0, 3)
  const op = OPERATORS.find((o) => o.codes.includes(code))
  return op ? op.key : 'other'
}

// Фірмова назва оператора (однакова для uk/en); для 'other'/невідомого — null (підпис бере виклик з i18n).
export function operatorName(key) {
  const op = OPERATORS.find((o) => o.key === key)
  return op ? op.name : null
}

export function countryName(country, language) {
  if (!country) return null
  return country.name[language === 'en' ? 'en' : 'uk']
}

export const OPERATOR_ORDER = ['kyivstar', 'vodafone', 'lifecell', 'other', 'none']

// Кілька номерів зберігаються в одному рядку через кому; тут розбираємо назад.
export function splitPhones(raw) {
  return (raw || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)
}

// Прибираємо дублікати номерів (порівнюємо за цифрами), зберігаючи порядок.
export function dedupPhones(list) {
  const seen = new Set()
  const out = []
  for (const p of list) {
    const d = phoneDigits(p)
    if (d && !seen.has(d)) {
      seen.add(d)
      out.push(p.trim())
    }
  }
  return out
}

// Перетворюємо введене на цифри E.164 (без "+"): прибираємо міжнародний префікс "00", а укр.
// національний запис (0 + 9 цифр) доповнюємо кодом країни 380.
function toE164Digits(raw) {
  let d = (raw || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 && d.startsWith('0')) d = '380' + d.slice(1)
  return d.slice(0, 15)
}

// Розбір номера: країна (за кодом), оператор (лише для України), чинність (кількість цифр за країною,
// усього ≤ 15) та канонічний запис "+<цифри>". Для невідомого коду — загальне правило 8–15 цифр.
export function parsePhone(raw) {
  const digits = toE164Digits(raw)
  const country = digits ? COUNTRIES.find((c) => digits.startsWith(c.code)) || null : null
  let valid = false
  if (!digits) valid = false
  else if (country) valid = country.nsn.includes(digits.length - country.code.length) && digits.length <= 15
  else valid = digits.length >= 8 && digits.length <= 15
  const operator = country?.iso === 'UA' ? phoneOperator(digits) : null
  return { digits, e164: digits ? '+' + digits : '', country, operator, valid }
}
