// Телефони: нормалізація й визначення мобільного оператора за кодом номера (правила, без ШІ).
// Українські мобільні коди (0XX). Якщо код невідомий — 'other'; якщо номера немає — обробляє виклик.

const OPERATORS = [
  { key: 'kyivstar', name: 'Kyivstar', codes: ['067', '068', '096', '097', '098', '077'] },
  { key: 'vodafone', name: 'Vodafone', codes: ['050', '066', '095', '099'] },
  { key: 'lifecell', name: 'lifecell', codes: ['063', '073', '093'] },
]

// Лишаємо самі цифри й приводимо +380…/380…/80… до вигляду 0XXXXXXXXX.
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

// Порядок груп у поданні "за оператором".
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
