// Спільні константи й хелпери модуля "Робота".

export const PAY_TYPES = ['hourly', 'monthly', 'project'] // погодинна / за місяць / за проєкт
export const CONTACT_STATUSES = ['online', 'busy', 'offline', 'vacation']
export const LEAVE_TYPES = ['vacation', 'sick'] // відпустка / лікарняний

// Режими (формати організації праці) — профіль роботи
export const WORK_REGIMES = [
  'standard', 'flexible', 'irregular', 'split', 'rotational', 'parttime', 'reduced', 'project', 'oncall',
]
// Місце роботи
export const WORKPLACES = ['onsite', 'remote', 'home']
// Види зміни — впливають на час/опис/оплату
export const SHIFT_KINDS = ['normal', 'flexible', 'split', 'oncall']

// Режими, для яких має сенс норма годин на тиждень
export const REGIMES_WITH_NORM = ['flexible', 'parttime', 'reduced']

// Пастельна палітра для типів змін (узгоджена з темою; користувач обирає свій колір на тип).
export const SHIFT_COLORS = [
  '#ffd59e', '#b3e5fc', '#d1c4e9', '#c5cae9',
  '#c8e6c9', '#f8bbd0', '#b2dfdb', '#ffab91',
]

// "HH:MM:SS" або "HH:MM" -> "HH:MM"
export function hhmm(time) {
  return (time ?? '').slice(0, 5)
}

// Проміжок часу зміни "07:00–15:00"
export function shiftRange(startTime, endTime) {
  return `${hhmm(startTime)}–${hhmm(endTime)}`
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

// Текстовий проміжок зміни з урахуванням виду (розділена показує обидві частини)
export function shiftRangeOf(s) {
  const main = shiftRange(s.startTime, s.endTime)
  if (s.kind === 'split' && s.startTime2 && s.endTime2) return `${main}, ${shiftRange(s.startTime2, s.endTime2)}`
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
