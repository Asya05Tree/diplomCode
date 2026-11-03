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

// Статус події за часом відносно `now`: 'past' | 'now' | 'future'.
// "now" = подія вже почалась і ще триває (start <= now < start+тривалість). Без тривалості
// подія вважається миттєвою — вона не буває "now" (тільки future до старту, past після).
export function timeStatusOf(startDateTime, durationMinutes, now = new Date()) {
  if (!startDateTime) return 'future'
  const start = fromApiDateTime(startDateTime)
  if (now < start) return 'future'
  if (durationMinutes && now < new Date(start.getTime() + durationMinutes * 60000)) return 'now'
  return 'past'
}

// Статус за ДАТОЮ (для Періоду): 'past' | 'today' | 'future' — порівнюємо лише день, не час.
export function dayStatusOf(startDateTime, now = new Date()) {
  if (!startDateTime) return 'future'
  const start = startOfDay(fromApiDateTime(startDateTime))
  const today = startOfDay(now)
  if (start < today) return 'past'
  if (start > today) return 'future'
  return 'today'
}

// Тривалість задачі обмежена 8 годинами.
export const MAX_DURATION_MINUTES = 480

// Години+хвилини → загальна тривалість у хвилинах (клампимо до [0, 480]); 0 → null (без тривалості).
export function combineDuration(hours, minutes) {
  const h = Math.max(0, Math.min(8, Math.floor(Number(hours) || 0)))
  const m = Math.max(0, Math.min(59, Math.floor(Number(minutes) || 0)))
  const total = Math.min(MAX_DURATION_MINUTES, h * 60 + m)
  return total > 0 ? total : null
}

// Хвилини → {hours, minutes} для початкового заповнення полів.
export function splitDuration(mins) {
  const total = Math.max(0, Math.min(MAX_DURATION_MINUTES, Math.floor(Number(mins) || 0)))
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

// "12:30" або "12:30 – 12:45" (якщо задано тривалість у хвилинах). Кінець = початок + тривалість.
export function formatTimeRange(startDateTime, durationMinutes) {
  if (!startDateTime) return '—'
  const start = fromApiDateTime(startDateTime)
  const startStr = formatTime(start)
  if (!durationMinutes) return startStr
  const end = new Date(start.getTime() + durationMinutes * 60000)
  return `${startStr} – ${formatTime(end)}`
}

// Групування задач за накладанням проміжків [початок, початок+тривалість). Повертає масив
// кластерів (масивів задач): новий кластер починається, коли початок задачі не раніше за
// найпізніший кінець поточного кластера. Задачі без тривалості трактуються як миттєві (кінець=початок),
// тож вони накладаються лише якщо справді потрапляють усередину чужого проміжку.
export function groupOverlapping(tasks) {
  const withTime = tasks.filter((t) => t.startDateTime)
  const noTime = tasks.filter((t) => !t.startDateTime)
  const endOf = (t) => fromApiDateTime(t.startDateTime).getTime() + (t.durationMinutes ? t.durationMinutes * 60000 : 0)

  const sorted = [...withTime].sort((a, b) => {
    const sa = fromApiDateTime(a.startDateTime).getTime()
    const sb = fromApiDateTime(b.startDateTime).getTime()
    return sa - sb
  })

  const clusters = []
  let current = null
  let currentMaxEnd = -Infinity
  for (const task of sorted) {
    const start = fromApiDateTime(task.startDateTime).getTime()
    if (current && start < currentMaxEnd) {
      current.push(task)
      currentMaxEnd = Math.max(currentMaxEnd, endOf(task))
    } else {
      current = [task]
      clusters.push(current)
      currentMaxEnd = endOf(task)
    }
  }
  // Задачі без часу — кожна окремим кластером (їх не з чим перетинати)
  for (const t of noTime) clusters.push([t])
  return clusters
}

// 6 тижнів (42 клітинки) із сусідніми місяцями для заповнення сітки. weekStart — ISO-номер
// першого дня тижня (1=Пн..7=Нд, дефолт понеділок); від нього рахується зсув початку сітки.
export function getMonthGridCells(year, month, weekStart = 1) {
  const firstOfMonth = new Date(year, month, 1)
  const firstWeekday = isoDayOfWeek(firstOfMonth)
  // Скільки днів відняти, щоб сітка починалася з обраного першого дня тижня
  const offset = (firstWeekday - weekStart + 7) % 7
  const gridStart = addDays(firstOfMonth, -offset)

  const cells = []
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i)
    cells.push({ date, inCurrentMonth: date.getMonth() === month })
  }
  return cells
}

// ISO-номери днів (1=Пн..7=Нд) у порядку показу, починаючи з weekStart.
// Напр. weekStart=2 (Вт) → [2,3,4,5,6,7,1]. Кодування даних лишається ISO — міняється лише показ.
export function orderedWeekDays(weekStart = 1) {
  return Array.from({ length: 7 }, (_, i) => ((weekStart - 1 + i) % 7) + 1)
}

// Числовий формат дати за налаштуванням користувача (planner-spec.md §4.10).
// Приймає Date або рядок "YYYY-MM-DD" / "YYYY-MM-DDTHH:MM". Повертає "—" для порожнього.
export function formatDateFor(value, dateFormat = 'dmy') {
  let y
  let m
  let d
  if (value instanceof Date) {
    y = value.getFullYear()
    m = value.getMonth() + 1
    d = value.getDate()
  } else if (typeof value === 'string' && value) {
    const parts = value.slice(0, 10).split('-').map(Number)
    ;[y, m, d] = parts
  }
  if (!y || !m || !d) return '—'
  const Y = String(y).padStart(4, '0')
  const M = String(m).padStart(2, '0')
  const D = String(d).padStart(2, '0')
  switch (dateFormat) {
    case 'mdy':
      return `${M}/${D}/${Y}`
    case 'ymd':
      return `${Y}-${M}-${D}`
    case 'ydm':
      return `${Y}.${D}.${M}`
    default:
      return `${D}.${M}.${Y}`
  }
}
