// Реєстр мов для парсера природномовного вводу. Щоб додати мову — додайте dict.<code>.js
// і впишіть його сюди; код рушія (parser.js) і UI чіпати не треба.
import uk from './dict.uk.js'
import en from './dict.en.js'
import { parseInput as parseWith, detectLanguage } from './parser.js'

const DICTS = [uk, en]

// Розібрати рядок користувача. Словники всіх мов передаються завжди — у змішаному тексті
// маркери обох мов шукаються одночасно (визначення мови лише для підпису результату).
export function parseInput(text, now = new Date()) {
  return parseWith(text, DICTS, now)
}

export { detectLanguage }
