// Реєстр мов для парсера природномовного вводу. Щоб додати мову — додайте dict.<code>.js
// і впишіть його сюди; код рушія (parser.js) і UI чіпати не треба.
import uk from './dict.uk.js'
import en from './dict.en.js'
import { parseInput as parseWith, detectLanguage, findUnsupportedChars } from './parser.js'

const DICTS = [uk, en]

// Жорстка межа довжини входу парсера: розбір синхронний і має над-лінійну складність, тож величезна
// вставка блокувала б головний потік на десятки секунд (ПЛАН P3-2). Понад межу — ріжемо вхід. Значення
// вдвічі більше за мʼякий лічильник MAX_INPUT=1000 у QuickAdd.jsx, тобто поза будь-яким реальним вводом.
const MAX_PARSE_LENGTH = 2000

// Розібрати рядок користувача. Словники всіх мов передаються завжди — у змішаному тексті
// маркери обох мов шукаються одночасно (визначення мови лише для підпису результату).
export function parseInput(text, now = new Date(), extraWords = []) {
  const capped = typeof text === 'string' && text.length > MAX_PARSE_LENGTH
    ? text.slice(0, MAX_PARSE_LENGTH)
    : text
  return parseWith(capped, DICTS, now, extraWords)
}

export { detectLanguage, findUnsupportedChars }
