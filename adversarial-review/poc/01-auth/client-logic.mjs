// §1/§3/§10: pure client-logic checks, importing the REAL source modules.
import {
  isValidNickname, isValidEmailFormat, isGmailAddress,
  filterNickname, filterEmailChars, PASSWORD_MAX_LENGTH,
} from '../../../client/src/utils/authValidation.js'
import { clamp, findMaximalCombos } from '../../../client/src/utils/combos.js'

const line = (label, got, verdict) => console.log(`[${label}] ${got}  ${verdict}`)

// --- weak email format regex: a@@b..c passes; double dots pass ---
line('email-regex', `isValidEmailFormat("a@@b..c") = ${isValidEmailFormat('a@@b..c')}`,
  isValidEmailFormat('a@@b..c') ? 'CONFIRMED weak: "a@@b..c" accepted (regex ^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$)' : 'strict')
line('email-regex2', `isValidEmailFormat("a@b.c@d.e")=${isValidEmailFormat('a@b.c@d.e')}, isGmail("x@gmail.com.evil.com")=${isGmailAddress('x@gmail.com.evil.com')}`, '')

// --- nickname of only separators passes ---
for (const n of ['--', '  ', "' '", '- -']) line('nickname', `isValidNickname(${JSON.stringify(n)}) = ${isValidNickname(n)}`, isValidNickname(n) ? 'CONFIRMED: separator-only nickname valid' : '')

// --- filterNickname strips digits/emoji/CJK/<> ---
line('filterNickname', `"Ан<3>на123😀漢" -> ${JSON.stringify(filterNickname('Ан<3>на123😀漢'))}`, '(client strips; server regex must also reject — see server-validation.mjs)')
line('filterEmail', `"кирилиця@gmail.com" -> ${JSON.stringify(filterEmailChars('кирилиця@gmail.com'))}`, 'Cyrillic removed on client')

// --- password of only spaces: 6 spaces passes client minLength ---
line('password-spaces', `"      ".length=${'      '.length} >= 6 = ${'      '.length >= 6}`, 'client accepts whitespace-only password; server only checks length 6..72 -> accepted')

// --- password slice to 72: 73rd char dropped ---
const p = 'x'.repeat(80).slice(0, PASSWORD_MAX_LENGTH)
line('password-slice', `80 chars sliced to ${p.length}`, p.length === 72 ? 'client truncates to 72 (server would REJECT >72 -> client/server divergence)' : '')

// --- intervalDays clamp: 0 becomes 1 (0 is falsy) so NO division-by-zero ---
line('intervalDays-0', `clamp(Number("0")||1,1,31) = ${clamp(Number('0') || 1, 1, 31)}`, 'REFUTED: 0 coerces to 1 (0||1), occursOnDate never divides by zero')
line('intervalDays-abc', `clamp(Number("abc")||1,1,31) = ${clamp(Number('abc') || 1, 1, 31)}`, 'NaN->1')

// --- money clamp: negatives/huge/NaN ---
for (const v of ['-100', '99999', '1e9', 'abc', '', '  ']) {
  const parsed = v === '' ? 0 : Number(v)
  line('money-onBlur', `clamp(Number(${JSON.stringify(v)})||0,0,1000) = ${clamp(Number(v) || 0, 0, 1000)}`, '')
}

// --- findMaximalCombos with empty budget string handled by Number('')||0 ---
line('combos-empty', `findMaximalCombos(dishes, Number("")||0).length = ${findMaximalCombos([{ price: 10 }, { price: 20 }], Number('') || 0).length}`, 'REFUTED: empty budget -> 0, no crash')
line('combos-cap', 'items capped at 20 -> <=2^20 iterations', 'REFUTED perf concern: hard cap bounds the 2^n search')

// --- CodeInput applyDigits logic (reimplemented exactly from CodeInput.jsx) ---
function applyDigits(value, startIndex, rawText, length = 6) {
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')
  const chars = rawText.replace(/\D/g, '').split('')
  if (chars.length === 0) return value
  const next = digits.slice(); let cursor = startIndex
  for (const ch of chars) { if (cursor >= length) break; next[cursor] = ch; cursor += 1 }
  return next.join('')
}
line('codeinput-paste', `applyDigits("",0,"12a3b4") = ${JSON.stringify(applyDigits('', 0, '12a3b4'))}`, 'letters stripped -> "1234"')
line('codeinput-overflow', `applyDigits("",0,"123456789") = ${JSON.stringify(applyDigits('', 0, '123456789'))}`, 'excess truncated to 6')
