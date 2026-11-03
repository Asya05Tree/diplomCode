// Спільні константи й хелпери модуля "Робота".

export const PAY_TYPES = ['hourly', 'monthly', 'project'] // погодинна / за місяць / за проєкт
export const CONTACT_STATUSES = ['online', 'busy', 'offline', 'vacation']
export const LEAVE_TYPES = ['vacation', 'sick'] // відпустка / лікарняний

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

// Скільки днів у відсутності (включно з обома кінцями)
export function leaveDays(startApi, endApi) {
  const [y1, m1, d1] = startApi.split('-').map(Number)
  const [y2, m2, d2] = endApi.split('-').map(Number)
  const a = new Date(y1, m1 - 1, d1)
  const b = new Date(y2, m2 - 1, d2)
  return Math.round((b - a) / 86400000) + 1
}
