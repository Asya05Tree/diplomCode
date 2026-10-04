// Чисті функції для роботи з датами — без бібліотек (проєкт свідомо без date-fns/dayjs,
// coding-guide.md §2 "без зайвих патернів"). Дати трактуються як голий wall-clock без
// часових поясів, як і на бекенді (TaskService.cs).

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

// 1=Пн..7=Нд — та сама кодировка, що й RecurrenceRule.DaysOfWeek на бекенді
export function isoDayOfWeek(date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

export function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// "2026-10-01" — для DateOnly-параметрів бекенду (from/to/date)
export function toApiDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// new Date("2026-10-01") в JS парситься як UTC-північ (а не локальний час) — тому дата-онлі
// рядки з бекенду розбираємо вручну, щоб не зʼїхати на день при негативному зсуві таймзони
export function fromApiDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fromApiDateTime(str) {
  const [datePart, timePart] = str.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, min, s] = (timePart ?? '00:00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, min, Math.floor(s || 0))
}

export function toApiDateTime(date) {
  return `${toApiDate(date)}T${formatTime(date)}:00`
}

// Завжди обчислюється заново в момент виклику — не кешувати в змінну/useMemo без залежностей,
// інакше "сьогодні" застаріє, якщо сторінка лишається відкритою через північ
export function todayApiDate() {
  return toApiDate(new Date())
}

export function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// 6 тижнів (42 клітинки), понеділок — перший день, із сусідніми місяцями для заповнення сітки
export function getMonthGridCells(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const firstWeekday = isoDayOfWeek(firstOfMonth)
  const gridStart = addDays(firstOfMonth, -(firstWeekday - 1))

  const cells = []
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i)
    cells.push({ date, inCurrentMonth: date.getMonth() === month })
  }
  return cells
}
