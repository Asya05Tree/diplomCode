// Рушій розбору природномовного вводу — на правилах і словниках, без зовнішніх сервісів.
// Мовно-незалежний: усі слова беруться зі словників (dict.*.js), переданих ззовні.
// П'ять кроків (точно за ТЗ):
//   1) розбити рядок на задачі за роздільниками та комою;
//   2) прогнати ВСІ регулярні вирази по всьому фрагменту (не зліва направо) → відрізки;
//   3) зняти перетини: вищий пріоритет перемагає, за рівного — довший;
//   4) зняти неоднозначності контекстом (є дата → голе число = час, і навпаки);
//   5) вирізати відрізки → отримати назву, зрізати прийменники по краях, визначити модуль.

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
    months: {}, timeMarkers: [], dayParts: {}, oclockWords: [],
    durationHours: [], durationMinutes: [], dayOfMonthWords: [], ordinalSuffixes: [],
    modules: { shopping: [], media: [], food: [] }, edgeWords: [],
  }
  for (const d of dicts) {
    merged.delimiters.push(...(d.delimiters || []))
    Object.assign(merged.relativeDates, d.relativeDates)
    Object.assign(merged.weekdays, d.weekdays)
    merged.weekdayMarkers.push(...(d.weekdayMarkers || []))
    merged.nextWeekMarkers.push(...(d.nextWeekMarkers || []))
    Object.assign(merged.months, d.months)
    merged.timeMarkers.push(...(d.timeMarkers || []))
    Object.assign(merged.dayParts, d.dayParts)
    merged.oclockWords.push(...(d.oclockWords || []))
    merged.durationHours.push(...(d.durationHours || []))
    merged.durationMinutes.push(...(d.durationMinutes || []))
    merged.dayOfMonthWords.push(...(d.dayOfMonthWords || []))
    merged.ordinalSuffixes.push(...(d.ordinalSuffixes || []))
    merged.edgeWords.push(...(d.edgeWords || []))
    for (const key of Object.keys(merged.modules)) merged.modules[key].push(...((d.modules || {})[key] || []))
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
        return { dateStr: resolveWeekday(iso, nextSet.has(marker), now) }
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

  const edge = new Set(m.edgeWords.map((w) => w.toLowerCase()))
  const trimPunct = (x) => x.replace(/^[\s,.;:–—-]+/, '').replace(/[\s,.;:–—-]+$/, '')
  let changed = true
  while (changed) {
    changed = false
    const before = s
    s = trimPunct(s)
    const tokens = s.split(' ').filter(Boolean)
    if (tokens.length && edge.has(tokens[0].toLowerCase())) { tokens.shift(); s = tokens.join(' '); changed = true }
    const t2 = s.split(' ').filter(Boolean)
    if (t2.length && edge.has(t2[t2.length - 1].toLowerCase())) { t2.pop(); s = t2.join(' '); changed = true }
    if (s !== before) changed = true
  }
  return s.trim()
}

function detectModule(piece, m) {
  const lower = piece.toLowerCase()
  let best = null
  for (const code of Object.keys(m.modules)) {
    const re = new RegExp(`${BB}(?:${alt(m.modules[code])})${BE}`, 'giu')
    const mm = re.exec(lower)
    if (mm && (best === null || mm.index < best.index)) best = { code, index: mm.index }
  }
  return best ? best.code : ''
}

// --- Складання однієї задачі з фрагмента (кроки 2–5) ---
function assemble(piece, m, now) {
  const accepted = resolveOverlaps(collect(piece, m, now))
  const dates = accepted.filter((s) => s.type === 'date').sort((a, b) => a.start - b.start)
  const times = accepted.filter((s) => s.type === 'time').sort((a, b) => a.start - b.start)
  const durs = accepted.filter((s) => s.type === 'duration').sort((a, b) => a.start - b.start)
  const nums = accepted.filter((s) => s.type === 'number').sort((a, b) => a.start - b.start)

  let date = dates[0]?.data.dateStr || ''
  let time = times[0]?.data.timeStr || ''
  const durationMinutes = durs[0]?.data.minutes ?? null

  // Крок 4. Знімаємо неоднозначності голих чисел контекстом.
  const ambiguous = []
  for (const seg of nums) {
    const n = seg.data.n
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

  const title = buildTitle(piece, accepted, m)
  const module = detectModule(piece, m)
  return { raw: piece.trim(), title, date, time, durationMinutes, module, ambiguous }
}

// Різні символи апострофа (ʼ ' ' ` ´) → один прямий, щоб "пʼятницю" збігалося зі словником.
// Заміна 1:1 за довжиною — індекси відрізків не зсуваються.
function normalizeApostrophes(text) {
  return text.replace(/[ʼ‘’‛`´]/g, "'")
}

// --- Крок 1. Розбиття рядка на фрагменти-задачі за роздільниками та комою. ---
function splitTasks(text, m) {
  const delim = alt(m.delimiters)
  // Спершу замінюємо роздільники-фрази на кому (незалежно від того, чи поруч уже є кома),
  // потім ділимо по комі, яка не стоїть між цифрами (щоб не ламати десяткове "4,5").
  const withSep = text.replace(new RegExp(`${BB}(?:${delim})${BE}`, 'giu'), ',')
  return withSep.split(/,(?!\d)/u).map((p) => p.trim()).filter(Boolean)
}

// Визначення мови за наявністю кирилиці/латиниці (окремого перемикача немає).
export function detectLanguage(text) {
  const cyr = /[Ѐ-ӿ]/.test(text)
  const lat = /[A-Za-z]/.test(text)
  if (cyr && lat) return 'mixed'
  return cyr ? 'uk' : 'en'
}

// Головна функція. dicts — масив словників (усі мови; у змішаному тексті шукаються одночасно).
// Повертає { language, tasks[], notRecognized[] }. Задачі НЕ створюються — лише для підтвердження.
export function parseInput(text, dicts, now = new Date()) {
  const raw = normalizeApostrophes((text || '').trim())
  if (!raw) return { language: 'uk', tasks: [], notRecognized: [] }
  const m = mergeDicts(dicts)
  const pieces = splitTasks(raw, m)

  const tasks = []
  const notRecognized = []
  for (const piece of pieces) {
    const task = assemble(piece, m, now)
    const empty = !task.title && !task.date && !task.time && !task.durationMinutes && !task.module && !task.ambiguous.length
    if (empty) notRecognized.push(task.raw)
    else tasks.push(task)
  }
  return { language: detectLanguage(raw), tasks, notRecognized }
}
