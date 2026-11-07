// §9 — rule-based guessShoppingCategory: substring + first-match-wins makes it fragile.
// No server needed: imports the real client util directly.
import { guessShoppingCategory, sectionForCategory } from '../../../client/src/utils/shoppingCategories.js'

const cases = [
  // [input, expectedCat, note]
  ['паста', 'grocery', 'макарони з ОПИСу ("паста 110 грн")'],
  ['макарони', 'grocery', 'контроль'],
  ['чайник', 'home', "'чай' підрядок перемагає 'home'"],
  ['мясо', 'meat_fish', 'контроль (без апострофа)'],
  ['мʼясо', 'meat_fish', "U+02BC апостроф"],
]

let bad = 0
for (const [input, expected, note] of cases) {
  const got = guessShoppingCategory(input)
  const ok = got === expected
  if (!ok) bad++
  console.log(`${ok ? 'OK  ' : 'BUG '} "${input}" -> ${got} (section ${sectionForCategory(got)}); expected ${expected}  — ${note}`)
}
console.log(bad > 0
  ? `\nCONFIRMED: ${bad} misclassification(s). Key bug: "паста" -> hygiene (Косметика) because 'паст' (shoppingCategories.js:63) ranks above 'макарон' (line 74); 'чай'∈'чайник'; U+02BC apostrophe not matched by "м'яс" (U+0027).`
  : '\nREFUTED')
