// Спільні константи й хелпери модуля "Робота".

export const LEAVE_TYPES = ['vacation', 'sick'] // відпустка / лікарняний
export const PROCESS_STATUSES = ['planned', 'doing', 'done'] // планую / роблю / зроблено

// Види зміни — впливають на час/опис
export const SHIFT_KINDS = ['normal', 'flexible', 'split', 'oncall']

// Пастельна палітра для типів змін (узгоджена з темою; користувач обирає свій колір на тип).
export const SHIFT_COLORS = [
  '#ffd59e', '#b3e5fc', '#d1c4e9', '#c5cae9',
  '#c8e6c9', '#f8bbd0', '#b2dfdb', '#ffab91',
]

// Контрастний колір тексту (темний/світлий) для ДОВІЛЬНОГО фону-hex за його яскравістю.
// Раніше текст чипа зміни був жорстко #243 — на темному/насиченому кольорі він ставав нечитаемим.
export function readableTextOn(hex) {
  const h = (hex ?? '').replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return '#20262f'
  // Відносна яскравість sRGB; світлий фон (>0.55) → темний текст, інакше світлий.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#20262f' : '#f8fafc'
}

// "HH:MM:SS" або "HH:MM" -> "HH:MM". fmt — опційний форматувач 12/24 з useI18n.
export function hhmm(time, fmt) {
  const base = (time ?? '').slice(0, 5)
  return fmt ? fmt(base) : base
}

// Проміжок часу зміни "07:00–15:00" (fmt — опційний форматувач 12/24).
export function shiftRange(startTime, endTime, fmt) {
  return `${hhmm(startTime, fmt)}–${hhmm(endTime, fmt)}`
}

// Години одного проміжку (нічні: кінець <= початок -> перехід через північ)
export function segmentHours(startTime, endTime) {
  const [sh, sm] = hhmm(startTime).split(':').map(Number)
  const [eh, em] = hhmm(endTime).split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  return mins / 60
}

// Загальна тривалість зміни з урахуванням виду: розділена зміна = обидві частини
export function shiftTotalHours(s) {
  let h = segmentHours(s.startTime, s.endTime)
  if (s.kind === 'split' && s.startTime2 && s.endTime2) h += segmentHours(s.startTime2, s.endTime2)
  return h
}

// Текстовий проміжок зміни з урахуванням виду (розділена показує обидві частини).
// fmt — опційний форматувач 12/24 з useI18n (дефолт — 24-годинний).
export function shiftRangeOf(s, fmt) {
  const main = shiftRange(s.startTime, s.endTime, fmt)
  if (s.kind === 'split' && s.startTime2 && s.endTime2) return `${main}, ${shiftRange(s.startTime2, s.endTime2, fmt)}`
  return main
}

// Скільки днів у відсутності (включно з обома кінцями)
export function leaveDays(startApi, endApi) {
  const [y1, m1, d1] = startApi.split('-').map(Number)
  const [y2, m2, d2] = endApi.split('-').map(Number)
  const a = new Date(y1, m1 - 1, d1)
  const b = new Date(y2, m2 - 1, d2)
  return Math.round((b - a) / 86400000) + 1
}
