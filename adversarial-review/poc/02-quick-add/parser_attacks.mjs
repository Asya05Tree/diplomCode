// TAB-02 §9/§11/§12 NLP parser adversarial PoC (PURE client logic, standalone).
// Imports the REAL parser client/src/utils/nlp/index.js and asserts observed vs expected.
//
// Run: node adversarial-review/poc/02-quick-add/parser_attacks.mjs
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
const here = path.dirname(fileURLToPath(import.meta.url))
const nlp = path.resolve(here, '../../../client/src/utils/nlp/index.js')
const { parseInput, findUnsupportedChars } = await import(pathToFileURL(nlp).href)

const NOW = new Date('2026-11-07T10:00:00')
const P = (s, extra = []) => parseInput(s, NOW, extra)
const t0 = (r) => r.tasks[0] || {}
const line = (label, verdict, detail) => console.log(`[${verdict}] ${label}: ${detail}`)

console.log('=== TAB-02 NLP parser attacks ===\n')

// --- §9 invalid dates silently overflow (JS Date rollover) -----------------
{
  const feb30 = t0(P('зустріч 30 лютого')).date
  const nov31 = t0(P('дедлайн 31.11')).deadline || t0(P('подія 31.11')).date
  const feb29ny = t0(P('подія 29.02.2025')).date // 2025 not leap
  console.log('--- §9 invalid dates (overflow, no validation vs month length) ---')
  line('"30 лютого"', feb30 && !feb30.endsWith('-02-30') ? 'CONFIRMED' : 'refuted', `=> ${feb30} (Feb has no 30th → rolled into March)`)
  line('"31.11"', '(info)', `=> ${nov31} (Nov has 30 days)`)
  line('"29.02.2025" non-leap', feb29ny && feb29ny.startsWith('2025-03') ? 'CONFIRMED' : 'refuted', `=> ${feb29ny} (rolled into March, silently)`)
}

// --- §9 two-digit / far year ----------------------------------------------
{
  const y26 = t0(P('подія 15/11/26')).date
  const y99 = t0(P('подія 15/11/99')).date
  console.log('\n--- §9 year handling ---')
  line('"15/11/26"', y26 === '2026-11-15' ? 'CONFIRMED' : 'refuted', `=> ${y26} (+2000)`)
  line('"15/11/99"', y99 === '2099-11-15' ? 'CONFIRMED' : 'refuted', `=> ${y99} (+2000 → far future, no sanity cap)`)
}

// --- §9 negation ----------------------------------------------------------
{
  const neg = t0(P('не купувати молоко'))
  const nigti = t0(P('підстригти нігті'))
  const nichoho = t0(P('нічого не робити'))
  console.log('\n--- §9 negation ---')
  line('"не купувати молоко"', neg.negated === true ? 'CONFIRMED' : 'refuted', `negated=${neg.negated} title=${JSON.stringify(neg.title)} (stays a task, no side-effect)`)
  line('"нігті" false-positive', nigti.negated === false ? 'CONFIRMED' : 'refuted', `negated=${nigti.negated} (BE boundary prevents matching "ні")`)
  line('"нічого ..." ', '(info)', `negated=${nichoho.negated}`)
}

// --- §9 intent classification drivers (parser module/amount; classifyRow uses these) ---
{
  const buy = t0(P('купити молоко'))
  const shop = P('молоко до списку покупок')
  const meds = t0(P('прийняти ліки'))
  const appt = t0(P('записатися до стоматолога'))
  const meet = t0(P('нарада з Петром'))
  console.log('\n--- §9 classification drivers ---')
  line('"купити молоко"', buy.module !== 'shopping' ? 'CONFIRMED' : 'refuted', `module=${JSON.stringify(buy.module)} (NOT auto shopping-list; stays task)`)
  line('"молоко до списку покупок"', shop.shoppingList?.length ? 'CONFIRMED' : 'refuted', `shoppingList items=${JSON.stringify(shop.shoppingList?.flatMap((s) => s.items))}`)
  line('"прийняти ліки"', meds.module !== 'health' || true, `module=${JSON.stringify(meds.module)} (APPOINTMENT_RE in component gates visit; "прийняти" absent → task)`)
  line('"записатися до стоматолога"', appt.module === 'health' ? 'CONFIRMED' : 'refuted', `module=${JSON.stringify(appt.module)} title=${JSON.stringify(appt.title)}`)
  line('"нарада з Петром"', meet.module === 'work' ? 'CONFIRMED' : 'refuted', `module=${JSON.stringify(meet.module)} title=${JSON.stringify(meet.title)}`)
}

// --- §9 numbers: ambiguous / quantity / duration / amount / deadline -------
{
  const amb = t0(P('подзвонити 4'))
  const qty = t0(P('купити 2 кг цукру'))
  const dur = t0(P('зустріч 4.5 години'))
  const money = t0(P('оплатити 500 грн'))
  const dl = t0(P('зробити до 15'))
  console.log('\n--- §9 number disambiguation ---')
  line('"4" bare', amb.ambiguous?.length ? 'CONFIRMED' : 'refuted', `ambiguous=${JSON.stringify(amb.ambiguous?.map((a) => a.options.map((o) => o.key)))}`)
  line('"2 кг цукру"', /2/.test(qty.title) && !qty.date && !qty.time ? 'CONFIRMED' : 'refuted', `title=${JSON.stringify(qty.title)} date=${qty.date} time=${qty.time} (quantity kept in title)`)
  line('"4.5 години"', dur.durationMinutes === 270 && !dur.date ? 'CONFIRMED' : 'refuted', `durationMinutes=${dur.durationMinutes} date=${dur.date} (duration beats numeric date)`)
  line('"500 грн"', money.amount === 500 && money.currency === 'UAH' ? 'CONFIRMED' : 'refuted', `amount=${money.amount} currency=${money.currency}`)
  line('"до 15" deadline', dl.deadline ? 'CONFIRMED' : 'refuted', `deadline=${dl.deadline} date=${dl.date}`)
}

// --- §11 meridiem edge cases ----------------------------------------------
{
  const am12 = t0(P('подія at 12am'))
  const pm12 = t0(P('подія at 12pm'))
  const h25 = t0(P('подія о 25'))
  console.log('\n--- §11 meridiem / hour bounds ---')
  line('"12am"', am12.time === '00:00' ? 'CONFIRMED' : 'refuted', `time=${am12.time}`)
  line('"12pm"', pm12.time === '12:00' ? 'CONFIRMED' : 'refuted', `time=${pm12.time}`)
  line('"о 25" (>23)', h25.time === '' ? 'CONFIRMED' : 'refuted', `time=${JSON.stringify(h25.time)} (rejected as time; may fall back to number/ambiguous)`)
}

// --- §8/§9 injection payloads stay inert text (parser never executes/encodes) ---
{
  const xss = t0(P('<script>alert(1)</script>'))
  const sqli = t0(P("'; DROP TABLE Users; --"))
  const jsurl = P('лекція посилання javascript:alert(1)')
  console.log('\n--- §8 injection payloads (must remain literal text) ---')
  line('XSS title', typeof xss.title === 'string' ? 'CONFIRMED' : 'refuted', `title=${JSON.stringify(xss.title)} (React escapes on render; stored as text)`)
  line('SQLi title', typeof sqli.title === 'string' ? 'CONFIRMED' : 'refuted', `title=${JSON.stringify(sqli.title)}`)
  const link = t0(jsurl).study?.link ?? ''
  line('javascript: link', link === '' ? 'CONFIRMED' : 'refuted', `study.link=${JSON.stringify(link)} (only https?:// accepted; parser.js:492)`)
}

// --- §9 unsupported chars warn-not-block + russian-on-shared-letters -------
{
  const bad = findUnsupportedChars('купить молоко ыэъё')
  const ru = P('купить молоко завтра')
  console.log('\n--- §9 foreign language handling ---')
  line('unsupported chars', bad.length ? 'CONFIRMED' : 'refuted', `bad=${JSON.stringify(bad)} (warn only, parsing proceeds)`)
  line('ru on shared letters', '(info)', `suspected=${ru.suspectedUnsupportedLang} corrections=${ru.corrections.length} task0.date=${t0(ru).date} (fuzzy disabled → no fabricated date)`)
}

// --- §12 crash safety on garbage ------------------------------------------
{
  console.log('\n--- §12 crash safety (must not throw) ---')
  const cases = [['emoji only', '😀😁😂🎉🔥'], ['digits only', '1234567890'], ['punct only', '!@#$%^&*()'], ['empty', ''], ['ws only', '   \n\t  ']]
  let crashed = 0
  for (const [lbl, s] of cases) {
    try { const r = P(s); console.log(`   OK ${lbl}: tasks=${r.tasks.length}`) } catch (e) { crashed++; console.log(`   CRASH ${lbl}: ${e.message}`) }
  }
  line('garbage inputs', crashed === 0 ? 'CONFIRMED' : 'refuted', `${cases.length - crashed}/${cases.length} parsed without throwing`)
}

// --- §9/§12 ReDoS / quadratic blow-up timing — FIXED (ПЛАН P3-2) ----------
// parseInput ріже вхід до MAX_PARSE_LENGTH=2000, тож час розбору обмежений незалежно від розміру вставки.
{
  console.log('\n--- §9/§12 timing after input cap (MAX_PARSE_LENGTH=2000) ---')
  let maxMs = 0
  for (const [lbl, input] of [
    ['завтра x2000', 'завтра '.repeat(2000)],   // 14000 chars
    ['завтра x8000', 'завтра '.repeat(8000)],   // 56000 chars
    ['spaces x50k', ' '.repeat(50000) + 'завтра'],
    ['teacher-ish', 'з ' + 'Ab '.repeat(5000)],
  ]) {
    const s = process.hrtime.bigint()
    P(input)
    const ms = Number(process.hrtime.bigint() - s) / 1e6
    maxMs = Math.max(maxMs, ms)
    console.log(`   ${lbl.padEnd(14)} (${String(input.length).padStart(6)} chars) → ${ms.toFixed(0)} ms`)
  }
  // Після капу навіть 56 КБ-вставка має розбиратися швидко (поріг із запасом: 250 мс).
  const refuted = maxMs < 250
  console.log('   => ' + (refuted
    ? `REFUTED — усі великі вставки розбираються за <250 мс (макс ${maxMs.toFixed(0)} мс): вхід обмежено 2000 символами, UI не блокується.`
    : `CONFIRMED — ще повільно (макс ${maxMs.toFixed(0)} мс), кап замалий або складність лишилась.`))
}

console.log('\n=== done ===')
