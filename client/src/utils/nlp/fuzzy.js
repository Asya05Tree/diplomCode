// Триграмний фаззі-матчер для виправлення друкарських помилок у СЛОВНИКОВИХ словах.
// Без ШІ, детермінований і пояснюваний: індекс триграм + коефіцієнт Дайса, з фінальною
// перевіркою відстані Левенштейна. Працює лише на НЕрозпізнаних токенах і лише проти
// лексикону самого парсера (дні тижня, місяці, маркери, числівники тощо) + опційних
// слів користувача (назви предметів/продуктів). Невідоме слово (якого немає поряд із
// жодним словниковим) НЕ чіпається — лишається в назві дослівно. Тобто "субботу"
// виправиться на "суботу", а "абоба" просто лишиться назвою — ми не «видаляємо сміття».

const L = '\\p{L}'

// Триграми слова з маркерами меж (два пробіли спереду, один позаду — класична схема,
// щоб початок/кінець слова теж давали триграми й короткі слова не зливались).
function trigrams(word) {
  const w = `  ${word} `
  const set = new Set()
  for (let i = 0; i < w.length - 2; i++) set.add(w.slice(i, i + 3))
  return set
}

// Побудувати індекс: триграма → множина слів, що її містять. Слова коротші за 3 літери
// ігноруємо (на них фаззі не працює — надто мало інформації, легко зіпсувати «і»/«в»).
export function buildFuzzyIndex(words) {
  const uniq = [...new Set(words.filter((w) => w && w.length >= 3).map((w) => w.toLowerCase()))]
  const tris = uniq.map(trigrams)
  const grams = new Map()
  tris.forEach((set, i) => {
    for (const g of set) {
      if (!grams.has(g)) grams.set(g, new Set())
      grams.get(g).add(i)
    }
  })
  return { words: uniq, tris, grams }
}

function dice(a, b) {
  let inter = 0
  for (const g of a) if (b.has(g)) inter++
  return (2 * inter) / (a.size + b.size)
}

// Відстань Левенштейна, обмежена (різниця довжин >3 → явно різні слова).
function levenshtein(a, b) {
  const m = a.length; const n = b.length
  if (Math.abs(m - n) > 3) return 99
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return prev[n]
}

// Найкращий словниковий збіг для токена, або null. Консервативно: точний збіг → null
// (нема що виправляти); кандидат проходить лише за достатньої триграмної схожості (Дайс)
// І малої відстані Левенштейна (похибка тим більша, чим довше слово, але не більш як ~len/4).
export function bestMatch(token, index, { minDice = 0.6 } = {}) {
  const t = token.toLowerCase()
  if (t.length < 3) return null
  const tg = trigrams(t)
  const cand = new Set()
  for (const g of tg) { const s = index.grams.get(g); if (s) for (const i of s) cand.add(i) }
  let best = null
  for (const i of cand) {
    const w = index.words[i]
    if (w === t) return null // точний словниковий збіг — це не помилка
    const d = dice(tg, index.tris[i])
    if (d < minDice) continue
    const lev = levenshtein(t, w)
    // Строго: короткі/середні слова — щонайбільше 1 правка, довші — 2. Межу піднято до ≤6,
    // щоб «квіти»(5)→«квітня»(6) (Lev 2) більше НЕ виправлялось (QA-05), а «субботу»→«суботу»
    // (Lev 1) лишилось. Краще недовиправити, ніж зіпсувати зміст слова.
    const maxLev = Math.max(t.length, w.length) <= 6 ? 1 : 2
    if (lev > maxLev) continue
    const score = d - lev * 0.05 // за рівного Дайса віддаємо перевагу меншій правці
    if (!best || score > best.score) best = { word: w, score, dice: d, lev }
  }
  return best
}

// Пройтись рядком і виправити схожі-на-словникові токени. Повертає { text, corrections }.
// Числа й дуже короткі слова пропускаємо; регістр першої літери зберігаємо.
// protect(tok) — предикат «це вже валідне слово» (прийменник/маркер/дата/основа модуля):
// такі токени НЕ чіпаємо, інакше реальні слова «виправляються» в структурні (the→then, QA-01).
export function fuzzyCorrect(text, index, protect = null) {
  const re = new RegExp(`${L}['\\-${L}]*`, 'gu') // слово: літери, всередині дозволені ' та -
  const corrections = []
  let out = ''
  let last = 0
  let mm
  while ((mm = re.exec(text)) !== null) {
    const tok = mm[0]
    out += text.slice(last, mm.index)
    last = re.lastIndex
    if (/\d/.test(tok) || tok.length < 3) { out += tok; continue }
    if (protect && protect(tok)) { out += tok; continue }
    const best = bestMatch(tok, index)
    if (best && best.word !== tok.toLowerCase()) {
      const fixed = /^\p{Lu}/u.test(tok) ? best.word.charAt(0).toUpperCase() + best.word.slice(1) : best.word
      corrections.push({ from: tok, to: fixed })
      out += fixed
    } else {
      out += tok
    }
  }
  out += text.slice(last)
  return { text: out, corrections }
}
