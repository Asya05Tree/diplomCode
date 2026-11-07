// Регрес-тести виправлень Quick Add (всі QA-ID з reproducible-bugs.md / quick-add-failures.md).
// Запуск:  node adversarial-review/poc/robustness/nlp_regression.mjs
// Фіксована дата NOW = 2026-11-07 09:00 (субота), як у ревʼю.

import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const nlpIndex = path.resolve(here, '../../../client/src/utils/nlp/index.js')
const { parseInput } = await import(pathToFileURL(nlpIndex).href)
const NOW = new Date(2026, 10, 7, 9, 0, 0)
const P = (s) => parseInput(s, NOW)

let pass = 0; let fail = 0
function check(id, input, cond, detail) {
  const r = P(input)
  let ok = false
  try { ok = cond(r) } catch { ok = false }
  if (ok) { pass++; console.log(`  ok   ${id}  ${JSON.stringify(input)}`) }
  else { fail++; console.log(`  FAIL ${id}  ${JSON.stringify(input)}\n       ${detail}\n       got: tasks=${JSON.stringify(r.tasks.map((t) => ({ title: t.title, date: t.date, time: t.time, mod: t.module, amount: t.amount, amb: t.ambiguous.length, xDates: t.extraDates, neg: t.negated })))} shop=${JSON.stringify(r.shoppingList.flatMap((s) => s.items))} suspect=${r.suspectedUnsupportedLang}`) }
}
const one = (r) => r.tasks.length === 1 ? r.tasks[0] : {}

console.log('=== Quick Add regression (NOW=2026-11-07) ===')

// QA-01 — "the" більше не дробить
check('QA-01a', 'clean the room', (r) => r.tasks.length === 1 && r.tasks[0].title === 'clean the room', '1 task, title intact')
check('QA-01b', 'pay the rent', (r) => r.tasks.length === 1, '1 task')
check('QA-01c', 'call on the fifth', (r) => r.tasks.length === 1 && one(r).title === 'call', '1 task, title "call"')

// QA-02 — безкомовий багатозадачний рядок
check('QA-02', "піти в магазин полити квіти завтра зробити хачапурі в середу вигуляти собаку в п'ятницю додати кефір",
  (r) => r.tasks.length >= 5, '≥5 tasks (was 2)')

// QA-03 — частковий розбір попри чужий символ
check('QA-03', 'tomorrow at 4pm в середу цветы', (r) => r.tasks.length >= 1 && one(r).time === '16:00', 'parses despite ы')

// QA-04 — російська: прапорець + без фальшивої дати
check('QA-04', 'встретиться с другом в пятницу', (r) => r.suspectedUnsupportedLang === true && !one(r).date, 'suspect flag, no fake date')

// QA-05 — фаззі не псує слово
check('QA-05', 'полити квіти', (r) => one(r).title === 'полити квіти', 'title kept')

// QA-06 — кількість лишається в назві, без ambiguous
check('QA-06a', 'купити 2 кг цукру', (r) => one(r).title.includes('2 кг') && one(r).ambiguous.length === 0, 'qty kept')
check('QA-06b', 'buy 2 apples', (r) => one(r).title.includes('2') && one(r).ambiguous.length === 0, 'qty kept')

// QA-08 — відносна дата без числа
check('QA-08a', 'екзамен через місяць', (r) => one(r).date === '2026-12-07', '+30 days')
check('QA-08b', 'call next week', (r) => one(r).date === '2026-11-14', '+7 days')

// QA-09 — друга дата не губиться
check('QA-09', 'подія 15 листопада та 20 листопада', (r) => one(r).date === '2026-11-15' && one(r).extraDates.includes('2026-11-20'), 'extra date surfaced')

// QA-10 — сума у Фінансах
check('QA-10a', 'заплатити 500 грн за інтернет', (r) => one(r).amount === 500 && one(r).currency === 'UAH' && one(r).module === 'finance', 'amount captured')
check('QA-10b', 'отримав зарплату 20000', (r) => one(r).amount === 20000 && one(r).financeType === 'income', 'income captured')

// QA-12 — заперечення
check('QA-12', 'не купувати молоко', (r) => one(r).negated === true, 'negated flag')

// QA-13 — голий предмет → study
check('QA-13', 'математика', (r) => one(r).module === 'study', 'module study')

// QA-14 — умовна фраза не скремблиться
check('QA-14', 'якщо встигну прибрати', (r) => one(r).title === 'якщо встигну прибрати', 'order kept')

// Явний список покупок (інтеграція) vs "купити" = задача
check('SHOP-1', 'додати молоко та хліб до списку покупок', (r) => r.tasks.length === 0 && r.shoppingList.flatMap((s) => s.items).length === 2, 'shopping-list only')
check('SHOP-2', 'купити молоко завтра', (r) => r.tasks.length === 1 && r.shoppingList.length === 0, 'stays a task')

// Регресії дизайну
check('REG-stock', 'додати молоко до запасів', (r) => r.stock.flatMap((s) => s.items).includes('молоко'), 'stock still works')
check('REG-single', 'сходити купити хліб', (r) => r.tasks.length === 1, 'no over-split')
check('REG-period', 'купити молоко. помити посуд.', (r) => r.tasks.length === 2, 'period split')
check('REG-weekanchor', 'через два тижні в четвер', (r) => one(r).date === '2026-11-19', 'week-anchor+weekday')

console.log(`\n=== ${pass} passed, ${fail} failed ===`)
process.exit(fail ? 1 : 0)
