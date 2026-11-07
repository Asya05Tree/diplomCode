// Рушій розбору природномовного вводу — на правилах і словниках, без зовнішніх сервісів.
// Мовно-незалежний: усі слова беруться зі словників (dict.*.js), переданих ззовні.
// П'ять кроків (точно за ТЗ):
//   1) розбити рядок на задачі за роздільниками та комою;
//   2) прогнати ВСІ регулярні вирази по всьому фрагменту (не зліва направо) → відрізки;
//   3) зняти перетини: вищий пріоритет перемагає, за рівного — довший;
//   4) зняти неоднозначності контекстом (є дата → голе число = час, і навпаки);
//   5) вирізати відрізки → отримати назву, зрізати прийменники по краях, визначити модуль.

import { buildFuzzyIndex, fuzzyCorrect } from './fuzzy.js'

// Межа "слова" з урахуванням Юнікоду (кирилиця не входить у \w, тому \b тут не годиться).
const L = '\\p{L}'
const BB = `(?<![${L}\\d])` // початок: ліворуч не літера й не цифра
const BE = `(?![${L}\\d])` //  кінець: праворуч не літера й не цифра

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Альтернація зі слів, відсортована за довжиною (довші — першими, щоб "листопада"
// не програвало "листопад"). Порожній список → вираз, що ніколи не збігається.
function alt(words) {
  const uniq = [...new Set(words.filter(Boolean))]
  if (!uniq.length) return '(?!x)x'
  return uniq.sort((a, b) => b.length - a.length).map(esc).join('|')
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function startOfToday(now) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

function toApiDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// --- Обʼєднання словників усіх мов (у змішаному тексті шукаємо маркери обох одночасно) ---

export function mergeDicts(dicts) {
  const merged = {
    delimiters: [], relativeDates: {}, weekdays: {}, weekdayMarkers: [], nextWeekMarkers: [],
    months: {}, ordinalWords: {}, timeMarkers: [], dayParts: {}, oclockWords: [],
    durationHours: [], durationMinutes: [], dayOfMonthWords: [], ordinalSuffixes: [],
    fillerWords: [], modules: {}, edgeWords: [],
    lessonMarkers: [], teacherMarkers: [], linkWords: [], noneWords: [],
    afterMarkers: [], numberWords: {}, durationUnits: {}, deadlineMarkers: [], byThenMarkers: [],
    verbs: [], subjectWords: [], stockMarkers: [], stockStopWords: [], stockVerbs: [],
  }
  for (const d of dicts) {
    merged.delimiters.push(...(d.delimiters || []))
    Object.assign(merged.relativeDates, d.relativeDates)
    Object.assign(merged.weekdays, d.weekdays)
    merged.weekdayMarkers.push(...(d.weekdayMarkers || []))
    merged.nextWeekMarkers.push(...(d.nextWeekMarkers || []))
    Object.assign(merged.months, d.months)
    Object.assign(merged.ordinalWords, d.ordinalWords)
    merged.timeMarkers.push(...(d.timeMarkers || []))
    Object.assign(merged.dayParts, d.dayParts)
    merged.oclockWords.push(...(d.oclockWords || []))
    merged.durationHours.push(...(d.durationHours || []))
    merged.durationMinutes.push(...(d.durationMinutes || []))
    merged.dayOfMonthWords.push(...(d.dayOfMonthWords || []))
    merged.ordinalSuffixes.push(...(d.ordinalSuffixes || []))
    merged.fillerWords.push(...(d.fillerWords || []))
    merged.edgeWords.push(...(d.edgeWords || []))
    merged.lessonMarkers.push(...(d.lessonMarkers || []))
    merged.teacherMarkers.push(...(d.teacherMarkers || []))
    merged.linkWords.push(...(d.linkWords || []))
    merged.noneWords.push(...(d.noneWords || []))
    merged.afterMarkers.push(...(d.afterMarkers || []))
    Object.assign(merged.numberWords, d.numberWords)
    Object.assign(merged.durationUnits, d.durationUnits)
    merged.deadlineMarkers.push(...(d.deadlineMarkers || []))
    merged.byThenMarkers.push(...(d.byThenMarkers || []))
    merged.verbs.push(...(d.verbs || []))
    merged.subjectWords.push(...(d.subjectWords || []))
    merged.stockMarkers.push(...(d.stockMarkers || []))
    merged.stockStopWords.push(...(d.stockStopWords || []))
    merged.stockVerbs.push(...(d.stockVerbs || []))
    // Коди модулів беремо з самих словників — додати модуль = дописати ключ у dict.*.js.
    for (const key of Object.keys(d.modules || {})) {
      merged.modules[key] = merged.modules[key] || []
      merged.modules[key].push(...d.modules[key])
    }
  }
  return merged
}

// --- Розвʼязання конкретних дат відносно "сьогодні" ---

function resolveMonthDay(month, day, year, now) {
  let y = year || now.getFullYear()
  let d = new Date(y, month - 1, day)
  if (!year && d < startOfToday(now)) d = new Date(++y, month - 1, day) // минула дата → наступний рік
  return toApiDate(d)
}

// Найближче майбутнє (або сьогодні) число місяця.
function resolveDayOfMonth(day, now) {
  const today = startOfToday(now)
  let d = new Date(now.getFullYear(), now.getMonth(), day)
  if (d < today) d = new Date(now.getFullYear(), now.getMonth() + 1, day)
  return toApiDate(d)
}

function resolveRelative(offset, now) {
  const d = startOfToday(now)
  d.setDate(d.getDate() + offset)
  return toApiDate(d)
}

function resolveWeekday(iso, nextWeek, now) {
  const todayIso = now.getDay() === 0 ? 7 : now.getDay()
  let delta = (iso - todayIso + 7) % 7 // 0 → сьогодні
  if (nextWeek) delta += 7
  const d = startOfToday(now)
  d.setDate(d.getDate() + delta)
  return toApiDate(d)
}

// День тижня В МЕЖАХ тижня (Пн–Нд), на який припадає опорна дата (сьогодні + anchorDays).
// Для "через два тижні в четвер": беремо тиждень через 2 тижні й знаходимо в ньому четвер.
function resolveWeekdayInWeek(anchorDays, iso, now) {
  const d = startOfToday(now)
  d.setDate(d.getDate() + anchorDays)
  const cur = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() + (iso - cur))
  return toApiDate(d)
}

// --- Крок 2. Матчери: від найконкретніших до найкоротших. Вищий priority перемагає. ---

function buildMatchers(m, now) {
  const months = alt(Object.keys(m.months))
  const rel = alt(Object.keys(m.relativeDates))
  const wdays = alt(Object.keys(m.weekdays))
  const wdMark = alt([...m.weekdayMarkers, ...m.nextWeekMarkers])
  const tMark = alt(m.timeMarkers)
  const dayParts = alt(Object.keys(m.dayParts))
  const oclock = alt(m.oclockWords)
  const durH = alt(m.durationHours)
  const durM = alt(m.durationMinutes)
  const domWords = alt(m.dayOfMonthWords)
  const ord = alt(m.ordinalSuffixes)
  const ordWords = alt(Object.keys(m.ordinalWords))
  const afterMark = alt(m.afterMarkers)
  const numWords = alt(Object.keys(m.numberWords))
  const units = alt(Object.keys(m.durationUnits))
  const nextSet = new Set(m.nextWeekMarkers.map((w) => w.toLowerCase()))

  const applyMeridiem = (hour, suffix) => {
    const s = (suffix || '').toLowerCase()
    const part = m.dayParts[s]
    if (s === 'pm' || part === 'pm') return hour < 12 ? hour + 12 : hour
    if (s === 'am' || part === 'am') return hour === 12 ? 0 : hour
    return hour
  }

  return [
    // 1) Дата з назвою місяця ("4 листопада", "листопада 4", "15 November 2026").
    {
      type: 'date', priority: 100,
      re: () => new RegExp(`${BB}(?:(\\d{1,2})\\s+(${months})|(${months})\\s+(\\d{1,2}))(?:\\s+(\\d{4}))?${BE}`, 'giu'),
      read: (mm) => {
        const day = Number(mm[1] || mm[4])
        const monthWord = (mm[2] || mm[3]).toLowerCase()
        const month = m.months[monthWord]
        const year = mm[5] ? Number(mm[5]) : null
        if (day < 1 || day > 31 || !month) return null
        return { dateStr: resolveMonthDay(month, day, year, now) }
      },
    },
    // 2) Тривалість ("2 години", "1.5 год", "30 хв", "2 h 30 min"). Вище за цифрову дату,
    //    щоб "4.5 години" не читалось як 4 травня.
    {
      type: 'duration', priority: 95,
      re: () => new RegExp(`${BB}(?:(\\d{1,2}(?:[.,]\\d{1,2})?)\\s*(?:${durH})(?:\\s*(\\d{1,2})\\s*(?:${durM}))?|(\\d{1,3})\\s*(?:${durM}))${BE}`, 'giu'),
      read: (mm) => {
        let minutes
        if (mm[1] != null) {
          const hours = parseFloat(mm[1].replace(',', '.'))
          minutes = Math.round(hours * 60) + (mm[2] ? Number(mm[2]) : 0)
        } else {
          minutes = Number(mm[3])
        }
        if (!minutes || minutes <= 0) return null
        return { minutes }
      },
    },
    // 3) Дата цифрами ("15.11", "15/11/2026").
    {
      type: 'date', priority: 90,
      re: () => new RegExp(`${BB}(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?${BE}`, 'giu'),
      read: (mm) => {
        const day = Number(mm[1])
        const month = Number(mm[2])
        let year = mm[3] ? Number(mm[3]) : null
        if (year != null && year < 100) year += 2000
        if (day < 1 || day > 31 || month < 1 || month > 12) return null
        return { dateStr: resolveMonthDay(month, day, year, now) }
      },
    },
    // 4) "N числа / N-го / Nth" — число місяця.
    {
      type: 'date', priority: 80,
      re: () => new RegExp(`${BB}(\\d{1,2})\\s*(?:${domWords})${BE}|${BB}(\\d{1,2})(?:-)?(?:${ord})${BE}`, 'giu'),
      read: (mm) => {
        const day = Number(mm[1] || mm[2])
        if (day < 1 || day > 31) return null
        return { dateStr: resolveDayOfMonth(day, now) }
      },
    },
    // 4б) Число місяця словом ("п'ятого", "twenty-first", "the fifth"). Форми — лише ті,
    //     що в ordinalWords (родовий відмінок), щоб "друга пара" не читалось як 2 число.
    {
      type: 'date', priority: 85,
      re: () => new RegExp(`${BB}(${ordWords})${BE}`, 'giu'),
      read: (mm) => {
        const day = m.ordinalWords[mm[1].toLowerCase()]
        if (!day) return null
        return { dateStr: resolveDayOfMonth(day, now) }
      },
    },
    // 4в) "через N одиниць" ("через два тижні", "in 3 days"). Потребує одиниці — тому
    //     "in 6 o'clock" сюди не потрапляє (там немає день/тиждень/місяць).
    {
      type: 'date', priority: 72,
      re: () => new RegExp(`${BB}(?:${afterMark})\\s+(\\d{1,2}|${numWords})\\s+(${units})${BE}`, 'giu'),
      read: (mm) => {
        const nRaw = mm[1].toLowerCase()
        const n = /^\d+$/.test(nRaw) ? Number(nRaw) : m.numberWords[nRaw]
        const unit = m.durationUnits[mm[2].toLowerCase()]
        if (!n || !unit) return null
        const days = n * unit
        // anchorDays/isWeekAnchor — щоб далі скомбінувати "через N тижнів" із днем тижня.
        return { dateStr: resolveRelative(days, now), anchorDays: days, isWeekAnchor: unit === 7 }
      },
    },
    // 5) Відносні дати ("завтра", "tomorrow").
    {
      type: 'date', priority: 70,
      re: () => new RegExp(`${BB}(${rel})${BE}`, 'giu'),
      read: (mm) => ({ dateStr: resolveRelative(m.relativeDates[mm[1].toLowerCase()], now) }),
    },
    // 6) Дні тижня з опційним маркером ("у понеділок", "next friday").
    {
      type: 'date', priority: 60,
      re: () => new RegExp(`${BB}(?:(${wdMark})\\s+)?(${wdays})${BE}`, 'giu'),
      read: (mm) => {
        const marker = (mm[1] || '').toLowerCase()
        const iso = m.weekdays[mm[2].toLowerCase()]
        return { dateStr: resolveWeekday(iso, nextSet.has(marker), now), iso }
      },
    },
    // 7) Час із маркером ("о 16:00", "о 4 годині", "at 4pm", "на 9").
    {
      type: 'time', priority: 55,
      re: () => new RegExp(`${BB}(?:${tMark})\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|${dayParts}|${oclock})?${BE}`, 'giu'),
      read: (mm) => {
        let hour = Number(mm[1])
        const minute = mm[2] ? Number(mm[2]) : 0
        hour = applyMeridiem(hour, mm[3])
        if (hour > 23 || minute > 59) return null
        return { timeStr: `${pad2(hour)}:${pad2(minute)}` }
      },
    },
    // 8) Час без маркера ("16:00", "4pm", "4 годині").
    {
      type: 'time', priority: 45,
      re: () => new RegExp(`${BB}(?:(\\d{1,2}):(\\d{2})\\s*(am|pm)?|(\\d{1,2})\\s*(am|pm)|(\\d{1,2})\\s*(?:${dayParts}|${oclock}))${BE}`, 'giu'),
      read: (mm) => {
        let hour; let minute = 0; let suffix = ''
        if (mm[1] != null) { hour = Number(mm[1]); minute = Number(mm[2]); suffix = mm[3] || '' }
        else if (mm[4] != null) { hour = Number(mm[4]); suffix = mm[5] || '' }
        else { hour = Number(mm[6]); const sfx = (mm[0].match(new RegExp(`(${dayParts})`, 'iu')) || [])[1]; suffix = sfx || '' }
        hour = applyMeridiem(hour, suffix)
        if (hour > 23 || minute > 59) return null
        return { timeStr: `${pad2(hour)}:${pad2(minute)}` }
      },
    },
    // 9) Голе число (низький пріоритет) — знімається контекстом на кроці 4.
    {
      type: 'number', priority: 10,
      re: () => new RegExp(`${BB}(\\d{1,2})${BE}`, 'giu'),
      read: (mm) => ({ n: Number(mm[1]) }),
    },
  ]
}

// Зібрати ВСІ збіги всіх матчерів по всьому фрагменту.
function collect(piece, m, now) {
  const segs = []
  for (const matcher of buildMatchers(m, now)) {
    const re = matcher.re()
    let mm
    while ((mm = re.exec(piece)) !== null) {
      if (mm.index === re.lastIndex) re.lastIndex++ // захист від нескінченного циклу на нуль-довжині
      if (!mm[0]) continue
      const data = matcher.read(mm)
      if (!data) continue
      segs.push({
        start: mm.index, end: mm.index + mm[0].length,
        text: mm[0], type: matcher.type, priority: matcher.priority, data,
      })
    }
  }
  return segs
}

// --- Крок 3. Зняти перетини: вищий пріоритет; за рівного — довший. ---
function resolveOverlaps(segs) {
  const sorted = [...segs].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return (b.end - b.start) - (a.end - a.start)
  })
  const accepted = []
  for (const seg of sorted) {
    const clashes = accepted.some((a) => seg.start < a.end && a.start < seg.end)
    if (!clashes) accepted.push(seg)
  }
  return accepted.sort((a, b) => a.start - b.start)
}

// --- Крок 5. Назва: вирізати відрізки, схлопнути пробіли, зрізати прийменники по краях. ---
function buildTitle(piece, accepted, m) {
  const chars = piece.split('')
  for (const seg of accepted) for (let i = seg.start; i < seg.end; i++) chars[i] = ' '
  let s = chars.join('').replace(/\s+/g, ' ').trim()

  // Нормалізація порядку: дієслово в кінці ("до лікаря піти") → наперед ("піти до лікаря").
  // Робимо ДО зрізання країв, щоб прийменник "до" опинився всередині й не зрізався. Один раз,
  // лише одне кінцеве дієслово, і лише якщо перше слово ще не дієслово.
  if (m.verbs.length) {
    const verbRe = new RegExp(`^(?:${alt(m.verbs)})${L}*$`, 'iu')
    const toks = s.split(' ').filter(Boolean)
    if (toks.length >= 2 && verbRe.test(toks[toks.length - 1]) && !verbRe.test(toks[0])) {
      s = [toks[toks.length - 1], ...toks.slice(0, -1)].join(' ')
    }
  }

  const edge = new Set(m.edgeWords.map((w) => w.toLowerCase()))
  const trimPunct = (x) => x.replace(/^[\s,.;:–—-]+/, '').replace(/[\s,.;:–—-]+$/, '')
  // Слова-пустушки зрізаємо лише з ПОЧАТКУ (фрази теж, напр. "не забути", "i want to").
  const fillerRe = new RegExp(`^(?:${alt(m.fillerWords)})(?![${L}\\d])`, 'iu')
  let changed = true
  while (changed) {
    changed = false
    const before = s
    s = trimPunct(s)
    const f = s.match(fillerRe)
    if (f && f[0].length) { s = s.slice(f[0].length); changed = true }
    const tokens = s.split(' ').filter(Boolean)
    if (tokens.length && edge.has(tokens[0].toLowerCase())) { tokens.shift(); s = tokens.join(' '); changed = true }
    const t2 = s.split(' ').filter(Boolean)
    if (t2.length && edge.has(t2[t2.length - 1].toLowerCase())) { t2.pop(); s = t2.join(' '); changed = true }
    if (s !== before) changed = true
  }
  return s.trim()
}

// Модуль визначаємо по ОСНОВІ слова: основа зі словника + будь-яке закінчення (${L}*).
// Перемагає найраніша за позицією основа; за рівної позиції — довша (точніша).
function detectModule(piece, m) {
  const lower = piece.toLowerCase()
  let best = null
  for (const code of Object.keys(m.modules)) {
    if (!m.modules[code]?.length) continue
    const re = new RegExp(`${BB}(?:${alt(m.modules[code])})${L}*${BE}`, 'giu')
    let mm
    while ((mm = re.exec(lower)) !== null) {
      if (mm.index === re.lastIndex) re.lastIndex++
      if (best === null || mm.index < best.index || (mm.index === best.index && mm[0].length > best.len)) {
        best = { code, index: mm.index, len: mm[0].length }
      }
    }
  }
  return best ? best.code : ''
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// Для модуля "Навчання": витягти предмет, викладача, номер пари й стан посилання.
// Усе редаговане на екрані підтвердження.
function extractStudy(piece, m) {
  const out = { subject: '', teacher: '', link: '', lessonNumber: null }
  const W = `[${L}'0-9.\\-]` // символи "слова" для імен/назв (з апострофом, крапкою, дефісом)
  const edge = new Set(m.edgeWords.map((w) => w.toLowerCase()))
  const lessonStem = alt(m.lessonMarkers)

  // Номер пари: "3 парою"/"3 пара" або "пара 3".
  if (m.lessonMarkers.length) {
    const mm = new RegExp(`${BB}(\\d{1,2})\\s*(?:${lessonStem})${L}*${BE}`, 'iu').exec(piece)
      || new RegExp(`${BB}(?:${lessonStem})${L}*\\s*(\\d{1,2})${BE}`, 'iu').exec(piece)
    if (mm) out.lessonNumber = Number(mm[1])
  }

  // Предмет: 1) відоме слово-предмет (за основою) будь-де; 2) інакше перше змістовне слово
  // після маркера заняття, пропускаючи прийменники, числа та імена з великої літери (викладач).
  const subjStem = alt(m.subjectWords)
  if (m.subjectWords.length) {
    const mm = new RegExp(`${BB}(?:${subjStem})${L}*${BE}`, 'iu').exec(piece)
    if (mm) out.subject = mm[0]
  }
  if (!out.subject && m.lessonMarkers.length) {
    const mm = new RegExp(`${BB}(?:${lessonStem})${L}*\\s+(.+)$`, 'iu').exec(piece)
    if (mm) {
      for (const raw of mm[1].split(/\s+/)) {
        const w = raw.replace(/[.,;:!?]+$/u, '')
        if (!w) continue
        if (edge.has(w.toLowerCase()) || /\d/.test(w) || /^\p{Lu}/u.test(w)) continue
        out.subject = w; break
      }
    }
  }

  // Викладач: після маркера викладача АБО після прийменника-зв'язки + слова з великої літери
  // ("з Віктором Федоровичем", "with Smith"). Беремо до 3 слів, зупиняємось на числі/стоп-слові.
  const tm = alt(m.teacherMarkers)
  let teacher = ''
  if (m.teacherMarkers.length) {
    const mm = new RegExp(`${BB}(?:${tm})${L}*\\s+(${W}+(?:\\s+${W}+){0,2})`, 'iu').exec(piece)
    if (mm) teacher = mm[1]
  }
  if (!teacher) {
    const cap = `\\p{Lu}[${L}'\\-]+`
    const mm = new RegExp(`${BB}(?:з|зі|із|від|у|в|with|by|of)\\s+(${cap}(?:\\s+${cap}){0,2})`, 'u').exec(piece)
    if (mm) teacher = mm[1]
  }
  if (teacher) {
    const stop = new Set([...m.lessonMarkers, ...m.linkWords, ...m.noneWords, ...m.subjectWords].map((w) => w.toLowerCase()))
    const kept = []
    for (const w of teacher.split(/\s+/)) {
      if (!w) continue
      if (/\d/.test(w)) break
      if ([...stop].some((s) => w.toLowerCase().startsWith(s))) break
      if (kept.length && !/^\p{Lu}/u.test(w)) break // після першого імені беремо лише слова з великої
      kept.push(w)
    }
    out.teacher = kept.join(' ')
  }

  // Посилання: URL після слова-маркера, або явна відмітка "немає".
  const lw = alt(m.linkWords)
  if (m.linkWords.length) {
    const re = new RegExp(`${BB}(?:${lw})\\s*:?\\s*(\\S+)?`, 'iu')
    const mm = re.exec(piece)
    if (mm) {
      const tail = (mm[1] || '').toLowerCase()
      if (/^https?:\/\//.test(mm[1] || '')) out.link = mm[1]
      else if (m.noneWords.some((n) => tail.startsWith(n.toLowerCase()))) out.link = ''
    }
  }
  return out
}

// Намір "додати до запасів": знаходимо маркер запасів і беремо ЛИШЕ сусідні з ним продукти
// (а не весь рядок), обмежуючи клаузу сполучниками/дієсловами-діями. Так "…купити ковбаску,
// додати молоко до запасів, а завтра пара" дає запас лише "молоко", а решта лишається задачами.
// Повертає { items, start, end } (діапазон клаузи для вирізання) або null.
function extractStock(sentence, m) {
  if (!m.stockMarkers.length) return null
  const mk = new RegExp(`${BB}(?:${alt(m.stockMarkers)})${BE}`, 'iu').exec(sentence)
  if (!mk) return null
  const markerStart = mk.index
  const markerEnd = mk.index + mk[0].length

  // Токени-слова з позиціями (для вирізання точного діапазону клаузи).
  const toks = []
  const tokRe = new RegExp(`[${L}'0-9]+`, 'giu')
  let tm
  while ((tm = tokRe.exec(sentence)) !== null) {
    toks.push({ text: tm[0], lower: tm[0].toLowerCase(), start: tm.index, end: tm.index + tm[0].length })
  }

  // Межі клаузи: сполучники "а/але/потім/then/but" + дати + дієслова-дії + числа зупиняють
  // збір; "і/та/й/and" — лише розділювачі переліку (не зупиняють). Дієслово-додавання (дода/add)
  // — природна межа, яку ВКЛЮЧАЄМО у виріз.
  const SEP = new Set(['і', 'та', 'й', 'and'])
  const STOP = new Set(['а', 'але', 'потім', 'опісля', 'також', 'then', 'also', 'plus', 'but', 'after'])
  const dateWords = new Set([...Object.keys(m.relativeDates), ...Object.keys(m.weekdays), ...Object.keys(m.months)])
  const verbRe = m.verbs.length ? new RegExp(`^(?:${alt(m.verbs)})${L}*$`, 'iu') : null
  const stockVerbRe = m.stockVerbs.length ? new RegExp(`^(?:${alt(m.stockVerbs)})${L}*$`, 'iu') : null
  const isStockVerb = (w) => Boolean(stockVerbRe && stockVerbRe.test(w))
  const isBoundary = (w) => STOP.has(w) || dateWords.has(w) || /^\d+$/.test(w) || Boolean(verbRe && verbRe.test(w))

  const beforeIdx = []
  const afterIdx = []
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].end <= markerStart) beforeIdx.push(i)
    else if (toks[i].start >= markerEnd) afterIdx.push(i)
  }

  // Збір продуктів у заданому напрямку. Повертає { picked, stockVerbTok }.
  const collect = (idxs, backward) => {
    const picked = []
    let stockVerbTok = null
    const order = backward ? [...idxs].reverse() : idxs
    for (const i of order) {
      const w = toks[i].lower
      if (SEP.has(w)) continue
      if (isStockVerb(w)) { stockVerbTok = toks[i]; break }
      if (isBoundary(w)) break
      if (backward) picked.unshift(toks[i])
      else picked.push(toks[i])
    }
    return { picked, stockVerbTok }
  }

  // Спершу продукти ПЕРЕД маркером ("молоко до запасів"); якщо їх немає — ПІСЛЯ ("додай до запасів молоко").
  let { picked, stockVerbTok } = collect(beforeIdx, true)
  if (!picked.length) {
    // Дієслово-додавання одразу перед маркером ("додай до запасів …") теж включаємо у виріз.
    const prev = beforeIdx.length ? toks[beforeIdx[beforeIdx.length - 1]] : null
    const lead = prev && isStockVerb(prev.lower) ? prev : null
    ;({ picked } = collect(afterIdx, false))
    stockVerbTok = lead
  }
  if (!picked.length) return null

  // Назви продуктів: поділ сусіднього тексту по комі / і / та / and; зрізаємо службові слова.
  const singleFillers = m.fillerWords.filter((w) => !/\s/.test(w))
  const stop = new Set([...m.stockStopWords, ...singleFillers, ...m.edgeWords].map((w) => w.toLowerCase()))
  const prodStart = picked[0].start
  const prodEnd = picked[picked.length - 1].end
  const region = sentence.slice(prodStart, prodEnd)
  const parts = region.split(new RegExp(`\\s*,\\s*|${BB}(?:і|та|й|and)${BE}`, 'giu'))
  const items = []
  for (const part of parts) {
    const words = (part || '').split(/\s+/)
      .map((w) => w.replace(/[.,;:!?]+$/u, ''))
      .filter(Boolean)
      .filter((w) => !stop.has(w.toLowerCase()))
    const name = words.join(' ').trim()
    if (name && new RegExp(`[${L}]`, 'u').test(name)) items.push(name)
  }
  if (!items.length) return null

  // Діапазон вирізання: продукти + маркер (+ дієслово-додавання, якщо межею стало саме воно).
  let start = Math.min(prodStart, markerStart)
  let end = Math.max(prodEnd, markerEnd)
  if (stockVerbTok) { start = Math.min(start, stockVerbTok.start); end = Math.max(end, stockVerbTok.end) }
  return { items, start, end }
}

// --- Складання однієї задачі з фрагмента (кроки 2–5) ---
function assemble(piece, m, now) {
  const accepted = resolveOverlaps(collect(piece, m, now))
  const dates = accepted.filter((s) => s.type === 'date').sort((a, b) => a.start - b.start)
  const times = accepted.filter((s) => s.type === 'time').sort((a, b) => a.start - b.start)
  const durs = accepted.filter((s) => s.type === 'duration').sort((a, b) => a.start - b.start)
  const nums = accepted.filter((s) => s.type === 'number').sort((a, b) => a.start - b.start)

  // Дата, перед якою стоїть маркер дедлайну ("до 15", "by friday"), — це термін, а не початок.
  const dlSet = new Set(m.deadlineMarkers.map((w) => w.toLowerCase()))
  const precededByDeadline = (seg) => {
    const before = piece.slice(0, seg.start).replace(/\s+$/u, '')
    const mm = before.match(new RegExp(`([${L}']+)$`, 'u'))
    return mm ? dlSet.has(mm[1].toLowerCase()) : false
  }
  // "через N тижнів" + день тижня → той самий день тижня цільового тижня (а не просто +Nднів).
  const consumed = new Set()
  const weekAnchor = dates.find((s) => s.data.isWeekAnchor)
  const weekdaySeg = dates.find((s) => s.data.iso != null)
  if (weekAnchor && weekdaySeg && weekAnchor !== weekdaySeg) {
    weekAnchor.data = { ...weekAnchor.data, dateStr: resolveWeekdayInWeek(weekAnchor.data.anchorDays, weekdaySeg.data.iso, now) }
    consumed.add(weekdaySeg)
  }

  let date = ''
  let deadline = ''
  for (const seg of dates) {
    if (consumed.has(seg)) continue
    if (!deadline && precededByDeadline(seg)) deadline = seg.data.dateStr
    else if (!date) date = seg.data.dateStr
  }
  let time = times[0]?.data.timeStr || ''
  const durationMinutes = durs[0]?.data.minutes ?? null

  // Число, за яким одразу йде маркер заняття ("3 парою"), — це номер пари, а не час/дата.
  const lessonAfter = new RegExp(`^\\s*(?:${alt(m.lessonMarkers)})${L}*${BE}`, 'iu')
  const isLessonNumber = (seg) => m.lessonMarkers.length && lessonAfter.test(piece.slice(seg.end))

  // Крок 4. Знімаємо неоднозначності голих чисел контекстом.
  const ambiguous = []
  for (const seg of nums) {
    if (isLessonNumber(seg)) continue
    const n = seg.data.n
    // "до 15" — голе число після маркера дедлайну → число місяця як термін.
    if (!deadline && precededByDeadline(seg) && n >= 1 && n <= 31) {
      deadline = resolveDayOfMonth(n, now)
      continue
    }
    const canDay = n >= 1 && n <= 31
    const canHour = n >= 0 && n <= 23
    if (date && !time && canHour) {
      time = `${pad2(n)}:00` // дата вже є → число = час
    } else if (time && !date && canDay) {
      date = resolveDayOfMonth(n, now) // час вже є → число = дата
    } else {
      // Контексту немає (або обидва поля зайняті) — лишаємо невизначеним, даємо вибір.
      const options = []
      if (canDay) options.push({ key: 'day', date: resolveDayOfMonth(n, now) })
      if (canHour) options.push({ key: 'am', time: `${pad2(n)}:00` })
      if (n >= 1 && n <= 11) options.push({ key: 'pm', time: `${pad2(n + 12)}:00` })
      if (options.length) ambiguous.push({ raw: seg.text, n, options })
    }
  }

  let title = buildTitle(piece, accepted, m)
  const module = detectModule(piece, m)

  // Навчання: витягаємо предмет/викладача/посилання. Якщо є предмет — він стає назвою
  // задачі (сирий рядок "пара математики викладач…" у назві не потрібен).
  let study = null
  if (module === 'study') {
    study = extractStudy(piece, m)
    if (study.subject) title = cap(study.subject)
  }

  // Рівень впевненості (порада ШІ — «три результати»): high — є дата (задача на час);
  // medium — дату не знайшли, але зрозуміли ТИП задачі (модуль); low — лише сирий текст у назві.
  let confidence = 'low'
  if (date || deadline) confidence = 'high'
  else if (module) confidence = 'medium'

  return { raw: piece.trim(), title, date, deadline, time, durationMinutes, module, ambiguous, study, confidence }
}

// Різні символи апострофа (ʼ ' ' ` ´) → один прямий, щоб "пʼятницю" збігалося зі словником.
// Заміна 1:1 за довжиною — індекси відрізків не зсуваються.
function normalizeApostrophes(text) {
  return text.replace(/[ʼ‘’‛`´]/g, "'")
}

// Поділ фрагмента за дієсловами: кожне наступне дієслово-дія починає нову задачу, але
// ЛИШЕ якщо між ним і попереднім дієсловом є змістовне слово-об'єкт (не прийменник). Так
// "подивитись кіно почитаю книгу" → дві задачі, а "сходити купити хліб" лишається однією.
function verbSplit(text, m) {
  if (!m.verbs.length) return [text]
  const re = new RegExp(`${BB}(?:${alt(m.verbs)})${L}*${BE}`, 'giu')
  const verbs = []
  let mm
  while ((mm = re.exec(text)) !== null) {
    if (mm.index === re.lastIndex) re.lastIndex++
    verbs.push({ start: mm.index, end: mm.index + mm[0].length })
  }
  if (verbs.length < 2) return [text]
  const edge = new Set(m.edgeWords.map((w) => w.toLowerCase()))
  const cuts = []
  for (let i = 1; i < verbs.length; i++) {
    const between = text.slice(verbs[i - 1].end, verbs[i].start)
    const hasObject = between.split(/\s+/).filter(Boolean).some((w) => !edge.has(w.toLowerCase()))
    if (!hasObject) continue
    let cut = verbs[i].start
    // Якщо перед дієсловом стоїть фраза-дедлайн ("до того часу придбати…"), вона стосується
    // НАСТУПНОЇ дії — переносимо межу перед неї, щоб не лишилась у попередній задачі.
    const head = text.slice(0, cut)
    for (const phrase of (m.byThenMarkers || [])) {
      const mm = new RegExp(`(^|\\s)(${esc(phrase)})\\s*$`, 'iu').exec(head)
      if (mm) { cut = mm.index + mm[1].length; break }
    }
    cuts.push(cut)
  }
  if (!cuts.length) return [text]
  const bounds = [0, ...cuts, text.length]
  const out = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const s = text.slice(bounds[i], bounds[i + 1]).trim()
    if (s) out.push(s)
  }
  return out
}

// --- Крок 1. Розбиття рядка на фрагменти-задачі за роздільниками, комою та дієсловами. ---
function splitTasks(text, m) {
  const delim = alt(m.delimiters)
  const HARD = '' // службовий маркер "твердої" межі речення
  // Роздільники-фрази та кома — "м'яка" межа (задачі одного ланцюжка, дата успадковується).
  // Крапка/;/!/? перед пробілом або кінцем рядка — "тверда" межа речення (дата НЕ успадковується).
  // Крапка не чіпає "4.5"/"15.11" — там після неї цифра.
  const withSep = text
    .replace(new RegExp(`${BB}(?:${delim})${BE}`, 'giu'), ',')
    .replace(/[.;!?]+(?=\s|$)/gu, HARD)
  const out = []
  withSep.split(HARD).forEach((segment, hi) => {
    segment.split(/,(?!\d)/u).map((p) => p.trim()).filter(Boolean)
      .forEach((text2, si) => {
        // Кожен фрагмент додатково ділимо за дієсловами (підзадачі — м'яка межа, дата успадковується).
        verbSplit(text2, m).forEach((sub, vi) => {
          out.push({ text: sub, hardBreak: hi > 0 && si === 0 && vi === 0 })
        })
      })
  })
  return out
}

// Літери, що підтримуються: латиниця (англ.) + українська кирилиця. Інші системи письма
// та суто російські літери (ё ъ ы э, яких немає в українській абетці) вважаємо непідтримуваними.
const SUPPORTED_LETTERS = new Set(
  (
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя' +
    'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ'
  ).split(''),
)

// Знаходить літери поза українською/англійською абеткою (напр. російські ы/э або інші мови).
// Потрібно, щоб Швидке додавання не намагалось розбирати текст, який воно не розуміє.
export function findUnsupportedChars(text) {
  const bad = new Set()
  for (const ch of String(text || '')) {
    if (/\p{L}/u.test(ch) && !SUPPORTED_LETTERS.has(ch)) bad.add(ch)
  }
  return [...bad]
}

// Часті РОСІЙСЬКІ слова, яких немає в українській (для м'якого попередження, коли текст
// складається лише зі спільних кириличних літер і гейт findUnsupportedChars мовчить, QA-04).
// Евристика, НЕ повний словник: що не зловилось — стане low-confidence задачею (не блокуємо).
const RU_HINTS = new Set([
  'что', 'это', 'чтобы', 'сейчас', 'нужно', 'надо', 'делать', 'сделать', 'сделай', 'сделаю',
  'купить', 'куплю', 'позвонить', 'позвони', 'убрать', 'убраться', 'встретиться', 'встретить',
  'пойти', 'сходить', 'забрать', 'приготовить', 'помыть', 'деньги', 'работу', 'уроки',
  'квартиру', 'маме', 'папе', 'другом', 'подруге', 'ещё', 'если', 'только', 'очень',
])

// Схоже на непідтримувану мову (напр. російську на спільних літерах)? М'який сигнал для UI.
export function looksUnsupportedLanguage(text) {
  const toks = String(text || '').toLowerCase().match(/[\p{L}']+/gu) || []
  return toks.some((w) => RU_HINTS.has(w))
}

// Визначення мови за наявністю кирилиці/латиниці (окремого перемикача немає).
export function detectLanguage(text) {
  const cyr = /[Ѐ-ӿ]/.test(text)
  const lat = /[A-Za-z]/.test(text)
  if (cyr && lat) return 'mixed'
  return cyr ? 'uk' : 'en'
}

// Лексикон для фаззі-виправлення: усі ПОВНІ словникові слова (без основ модулів — ті
// лише префікси). extraWords — слова користувача (напр. назви предметів), щоб виправляти
// й друкарські помилки в них. Основи дієслів/предметів теж додаємо як підказку.
function fuzzyLexicon(m, extraWords) {
  const words = [
    ...Object.keys(m.relativeDates), ...Object.keys(m.weekdays), ...Object.keys(m.months),
    ...Object.keys(m.ordinalWords), ...Object.keys(m.numberWords), ...Object.keys(m.durationUnits),
    ...Object.keys(m.dayParts), ...m.oclockWords, ...m.durationHours, ...m.durationMinutes,
    ...m.dayOfMonthWords, ...m.weekdayMarkers, ...m.nextWeekMarkers, ...m.afterMarkers,
    ...m.timeMarkers, ...m.noneWords, ...m.linkWords, ...m.fillerWords,
    ...(extraWords || []),
    // УВАГА: m.verbs і m.subjectWords — це ОСНОВИ (префікси), а не повні слова; у лексикон
    // фаззі їх НЕ додаємо, інакше повні слова "виправлялись" би до основи (почитаю→почит).
    // m.delimiters теж НЕ додаємо: хибна корекція в роздільник (the→then) плодить зайву
    // задачу (найдорожча помилка), а типова у "потім"/"then" рідкісна (QA-01).
  ]
  // Багатослівні записи (фрази) у фаззі не беремо — звіряємо потокенно.
  return words.filter((w) => w && !/\s/.test(w))
}

// Предикат «токен — це вже валідне словникове слово / основа», який боронить його від
// фаззі-корекції. Точні слова (прийменники, маркери, дати, числівники) + основи модулів/
// дієслів/предметів. Так "the"/"them"/"they" (edgeWords) не стають "then" (QA-01), а власні
// дієслова/предмети не псуються. Невідомі слова (напр. "субботу") лишаються під корекцією.
function buildFuzzyProtect(m) {
  const exact = new Set()
  const addWords = (arr) => { for (const w of arr || []) if (w && !/\s/.test(w)) exact.add(w.toLowerCase()) }
  addWords(m.edgeWords); addWords(m.fillerWords); addWords(m.delimiters)
  addWords(Object.keys(m.relativeDates)); addWords(Object.keys(m.weekdays)); addWords(Object.keys(m.months))
  addWords(Object.keys(m.ordinalWords)); addWords(Object.keys(m.numberWords)); addWords(Object.keys(m.durationUnits))
  addWords(Object.keys(m.dayParts)); addWords(m.oclockWords); addWords(m.timeMarkers); addWords(m.afterMarkers)
  addWords(m.noneWords); addWords(m.linkWords); addWords(m.dayOfMonthWords)
  addWords(m.weekdayMarkers); addWords(m.nextWeekMarkers); addWords(m.durationHours); addWords(m.durationMinutes)
  const stems = [...m.verbs, ...m.subjectWords, ...Object.values(m.modules).flat()]
    .filter((s) => s && typeof s === 'string').map((s) => s.toLowerCase())
  return (tok) => {
    const t = tok.toLowerCase()
    if (exact.has(t)) return true
    for (const s of stems) if (s.length >= 3 && t.startsWith(s)) return true
    return false
  }
}

// Головна функція. dicts — масив словників (усі мови; у змішаному тексті шукаються одночасно).
// extraWords — додаткові слова для фаззі (назви предметів/продуктів користувача).
// Повертає { language, tasks[], notRecognized[], corrections[] }. Задачі НЕ створюються.
export function parseInput(text, dicts, now = new Date(), extraWords = []) {
  const raw0 = normalizeApostrophes((text || '').trim())
  if (!raw0) return { language: 'uk', tasks: [], notRecognized: [], corrections: [], stock: [] }
  const m = mergeDicts(dicts)

  // Крок 0. Фаззі-виправлення друкарських помилок у словникових словах (субботу→суботу).
  // protect боронить уже-валідні слова/основи від корекції (the→then тощо, QA-01/QA-05).
  // Якщо текст схожий на непідтримувану мову (рос.) — фаззі ВИМИКАЄМО: інакше рос. слова
  // «виправляються» в укр. структуру й фабрикують хибні дати ("пятницу"→"п'ятницю", QA-04).
  const suspected = looksUnsupportedLanguage(raw0)
  const index = buildFuzzyIndex(fuzzyLexicon(m, extraWords))
  const { text: raw, corrections } = suspected
    ? { text: raw0, corrections: [] }
    : fuzzyCorrect(raw0, index, buildFuzzyProtect(m))

  // Крок 0.5. Речення-запаси ("додати до запасів…") виймаємо ДО поділу на задачі, щоб
  // перелік через кому не ділився на окремі задачі. Решта тексту йде у звичайний розбір.
  const stock = []
  let forTasks = raw
  if (m.stockMarkers.length) {
    const markerRe = new RegExp(`${BB}(?:${alt(m.stockMarkers)})${BE}`, 'iu')
    const sentences = raw.split(/(?<=[.!?;])\s+/u)
    const kept = []
    for (let s of sentences) {
      // У реченні може бути кілька намірів-запасів: виймаємо КЛАУЗУ запасів по черзі,
      // лишаючи решту тексту під звичайні задачі (а не ковтаючи все речення цілком).
      let guard = 0
      while (markerRe.test(s) && guard++ < 10) {
        const found = extractStock(s, m)
        if (!found) break
        stock.push({ raw: s.slice(found.start, found.end).trim(), items: found.items })
        s = `${s.slice(0, found.start)} ${s.slice(found.end)}`.replace(/\s+/g, ' ').trim()
      }
      if (s.trim()) kept.push(s)
    }
    // Крапка між колишніми реченнями — тверда межа (дата не успадковується через неї).
    forTasks = kept.join('. ')
  }

  const pieces = splitTasks(forTasks, m)
  const tasks = []
  const notRecognized = []
  // Успадкування дати: якщо задача не має своєї дати, бере дату попередньої розпізнаної.
  // inheritedDate позначаємо такі, щоб на екрані підтвердження це було видно.
  const byThenRe = m.byThenMarkers.length ? new RegExp(`${BB}(?:${alt(m.byThenMarkers)})${BE}`, 'iu') : null
  let lastDate = ''
  for (const piece of pieces) {
    if (piece.hardBreak) lastDate = '' // нове речення — не успадковуємо дату з попереднього
    const byThen = byThenRe ? byThenRe.test(piece.text) : false
    // Фразу "до того часу" прибираємо з тексту перед розбором, щоб вона не лишалась у назві.
    const pieceText = byThen ? piece.text.replace(byThenRe, ' ') : piece.text
    const task = assemble(pieceText, m, now)
    // Третій результат (порада ШІ): нерозпізнаний, але змістовний текст — це НЕ провал, а
    // звичайна задача з сирою назвою (confidence='low', редагується на екрані). Глухого списку
    // "не розпізнано" більше немає. Відкидаємо лише фрагменти, що після зрізання службових слів
    // не лишили жодної назви (самі прийменники/пустушки: "хочу", "в на до", "ееее").
    const empty = !task.title && !task.date && !task.deadline && !task.time
      && !task.durationMinutes && !task.module && !task.ambiguous.length
    if (empty) continue
    // "до того часу" → термін = попередня дата; при цьому дату-початок НЕ успадковуємо.
    if (byThen && !task.deadline && lastDate) { task.deadline = lastDate; task.inheritedDeadline = true }
    if (task.date) lastDate = task.date
    else if (task.deadline) lastDate = task.deadline
    else if (lastDate && !byThen) { task.date = lastDate; task.inheritedDate = true }
    tasks.push(task)
  }
  return {
    language: detectLanguage(raw), tasks, notRecognized, corrections, stock,
    suspectedUnsupportedLang: suspected,
  }
}
