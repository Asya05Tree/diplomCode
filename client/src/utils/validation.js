// Спільні правила валідації вводу для всього застосунку: числа — лише числа й у реалістичних
// межах; поля-назви — лише укр/англ літери; скрізь обмеження довжини. Набір символів імені
// узгоджений з utils/authValidation.js та AuthController.NicknamePattern на бекенді.

// Реалістичні діапазони числових полів (нижня/верхня межа).
// Вік: мінімум 6 — такий мінімальний вік користувача сервісу (див. юридичні сторінки, Умови
// користування, та примітку в реєстрації). Вага/зріст — у межах реальних людських значень
// (без 1 кг чи 3 м), щоб явні одруки клампились у притомне число.
export const RANGES = {
  weight: { min: 10, max: 400 }, // кг
  height: { min: 90, max: 250 }, // см
  age: { min: 6, max: 120 }, // років
  money: { min: 0, max: 1_000_000_000 }, // грн
  quantity: { min: 1, max: 9999 }, // шт
  durationMin: { min: 1, max: 1440 }, // хв (доба)
  intervalDays: { min: 1, max: 365 }, // днів
  grade: { min: 1, max: 12 }, // шкільна шкала
}

// Обмеження довжини текстових полів.
export const MAX_LEN = {
  name: 60, // назва (захворювання тощо)
  description: 200, // вільний опис
  title: 120, // заголовок задачі
}

// Будь-яка літера Unicode (\p{L}) + діакритичні знаки (\p{M}) + пробіл/дефіс/апостроф. Раніше був
// жорсткий ASCII+кирилиця діапазон, що мовчки різав CJK і діакритику з імен-даних (напр. автор книги
// «Müller», «村上春樹») — ПЛАН P3-5. Інтерфейс лишається uk/en, але дані-назви не обмежуємо алфавітом.
// (Нік користувача має власне правило в authValidation.js — тут його не чіпаємо.)
const WORD_CHAR = /[\p{L}\p{M}'ʼ -]/u

// Залишає тільки літери (будь-яка мова) + пробіл/дефіс/апостроф і обрізає до ліміту.
export function filterWords(text, maxLen = MAX_LEN.name) {
  return text
    .split('')
    .filter((ch) => WORD_CHAR.test(ch))
    .join('')
    .slice(0, maxLen)
}

// Обмежує вільний текст лише довжиною (алфавіт не чіпаємо — опис може бути будь-яким).
export function limitText(text, maxLen = MAX_LEN.description) {
  return text.slice(0, maxLen)
}

// Клампить число у [min, max]; порожнє/нечисло → null (поле можна лишити порожнім).
export function clampNumber(value, min, max) {
  if (value === '' || value == null) return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return Math.min(max, Math.max(min, n))
}
