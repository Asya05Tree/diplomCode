// Модуль "Цикл" (planner-spec.md §3.7), поки без бекенду — CycleRecord/CycleSettings ще не
// реалізовані як API (заплановано на Місяць 5), тому дані живуть у localStorage, за тим самим
// принципом, що й список покупок (utils/shoppingList.js) і фінанси (utils/finance.js).
import { addDays, fromApiDate, toApiDate, todayApiDate } from './date'

const RECORDS_KEY = 'cycle:records'
const SETTINGS_KEY = 'cycle:settings'
const STOCK_KEY = 'cycle:stock'

const DEFAULT_CYCLE_LENGTH = 28
const NO_DATA_RANGE_DAYS = 5
const REGULAR_SPREAD_THRESHOLD_DAYS = 3

// Запаси, які перевіряються перед прогнозованою датою (planner-spec.md §3.7 "Проверка запасов
// к дате") — той самий розрахунок нехватки, що й для продуктів, тому стан тут навмисно
// обмежений тими самими трьома значеннями, що й StockItem.State (§3.4): Available | RunningLow | OutOfStock.
const DEFAULT_STOCK_ITEMS = [
  { id: 'pads', nameKey: 'cycle.stock.pads', state: 'Available' },
  { id: 'painkiller', nameKey: 'cycle.stock.painkiller', state: 'Available' },
  { id: 'sweets', nameKey: 'cycle.stock.sweets', state: 'Available' },
]

export function getCycleRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    const list = raw ? JSON.parse(raw) : []
    // Сортуємо за початком — порядок введення не гарантований (запис заднім числом тощо)
    return list.sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
  } catch {
    return []
  }
}

function saveCycleRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
}

// Відмітка "початок" ніколи не додумується поверх попереднього запису (planner-spec.md §3.7
// "Пропущенная отметка не додумывается") — це завжди новий запис, навіть якщо попередній
// лишився без дати завершення.
export function markCycleStart(dateStr) {
  const records = getCycleRecords()
  const record = {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    startDate: dateStr,
    endDate: null,
  }
  saveCycleRecords([...records, record])
  return record
}

export function markCycleEnd(id, dateStr) {
  const records = getCycleRecords().map((r) => (r.id === id ? { ...r, endDate: dateStr } : r))
  saveCycleRecords(records)
}

export function deleteCycleRecord(id) {
  saveCycleRecords(getCycleRecords().filter((r) => r.id !== id))
}

export function getOpenRecord(records) {
  return records.find((r) => !r.endDate) ?? null
}

export function getCycleSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : { reduceLoadOnHeavyDays: false }
  } catch {
    return { reduceLoadOnHeavyDays: false }
  }
}

export function setReduceLoadOnHeavyDays(value) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ reduceLoadOnHeavyDays: value }))
}

// Прогноз (planner-spec.md §3.7): без даних — ±5 днів; розкид між довжинами циклів ≤3 дні —
// вузький діапазон; розкид більший — ширший діапазон з чесним поясненням "цикл нерегулярний".
export function computeForecast(records) {
  const starts = records.map((r) => r.startDate).sort()

  if (starts.length === 0) {
    return { hasData: false, predictedDate: null, rangeDays: NO_DATA_RANGE_DAYS, isRegular: null }
  }

  const lastStart = starts[starts.length - 1]

  if (starts.length === 1) {
    return {
      hasData: true,
      insufficientHistory: true,
      predictedDate: toApiDate(addDays(new Date(lastStart), DEFAULT_CYCLE_LENGTH)),
      rangeDays: NO_DATA_RANGE_DAYS,
      isRegular: null,
    }
  }

  const lengths = []
  for (let i = 1; i < starts.length; i++) {
    const days = Math.round((new Date(starts[i]) - new Date(starts[i - 1])) / 86400000)
    lengths.push(days)
  }
  const avg = lengths.reduce((sum, n) => sum + n, 0) / lengths.length
  const spread = Math.max(...lengths) - Math.min(...lengths)
  const isRegular = spread <= REGULAR_SPREAD_THRESHOLD_DAYS

  const rangeDays = isRegular ? 2 : Math.ceil(spread / 2) + 2

  return {
    hasData: true,
    insufficientHistory: false,
    predictedDate: toApiDate(addDays(new Date(lastStart), Math.round(avg))),
    rangeDays,
    isRegular,
    averageLength: Math.round(avg),
  }
}

const DEFAULT_PERIOD_LENGTH = 6

function daysBetween(aApi, bApi) {
  return Math.round((fromApiDate(bApi) - fromApiDate(aApi)) / 86400000)
}

function addApiDays(api, n) {
  return toApiDate(addDays(fromApiDate(api), n))
}

// Показники місячних (дашборд-варіант 6): день циклу, середня довжина циклу й
// менструації, останній цикл, регулярність. Усе рахується з реальних відміток
// користувача — це не медичні висновки, а статистика по його ж даних.
export function computeCycleStats(records) {
  const starts = records.map((r) => r.startDate).sort()
  if (starts.length === 0) {
    return { hasData: false, avgCycleLength: DEFAULT_CYCLE_LENGTH }
  }

  const lastStart = starts[starts.length - 1]
  const lastRecord = records.find((r) => r.startDate === lastStart)
  const lastEnd = lastRecord?.endDate ?? null

  const periodLengths = records.filter((r) => r.endDate).map((r) => daysBetween(r.startDate, r.endDate) + 1)
  const avgPeriodLength = periodLengths.length
    ? Math.round(periodLengths.reduce((s, n) => s + n, 0) / periodLengths.length)
    : null

  const cycleLengths = []
  for (let i = 1; i < starts.length; i++) cycleLengths.push(daysBetween(starts[i - 1], starts[i]))
  const avgCycleLength = cycleLengths.length
    ? Math.round(cycleLengths.reduce((s, n) => s + n, 0) / cycleLengths.length)
    : DEFAULT_CYCLE_LENGTH
  const lastCycleLength = cycleLengths.length ? cycleLengths[cycleLengths.length - 1] : null
  const spread = cycleLengths.length ? Math.max(...cycleLengths) - Math.min(...cycleLengths) : null
  const isRegular = spread === null ? null : spread <= REGULAR_SPREAD_THRESHOLD_DAYS

  // День циклу рахуємо від останньої відмітки "початок" до сьогодні (включно).
  const cycleDay = Math.max(1, daysBetween(lastStart, todayApiDate()) + 1)

  return { hasData: true, lastStart, lastEnd, avgPeriodLength, avgCycleLength, lastCycleLength, isRegular, cycleDay }
}

// Усі фази циклу (орієнтовні — похідні від середніх, а не діагноз). Повертає
// порядок менструація → фолікулярна → овуляція → лютеїнова → прогноз наступної.
export function computeCyclePhases(records, forecast, stats) {
  if (!stats.hasData || !forecast?.predictedDate) return []

  const periodLen = stats.avgPeriodLength ?? DEFAULT_PERIOD_LENGTH
  const periodStart = stats.lastStart
  const periodEnd = stats.lastEnd ?? addApiDays(periodStart, periodLen - 1)
  const nextStart = forecast.predictedDate
  const ovulation = addApiDays(nextStart, -14) // лютеїнова фаза ~14 днів — орієнтовно
  const today = todayApiDate()

  const phases = [
    { key: 'menstruation', from: periodStart, to: periodEnd },
    { key: 'follicular', from: addApiDays(periodEnd, 1), to: addApiDays(ovulation, -1) },
    { key: 'ovulation', from: ovulation, to: ovulation, approx: true },
    { key: 'luteal', from: addApiDays(ovulation, 1), to: addApiDays(nextStart, -1) },
    { key: 'predicted', from: nextStart, to: addApiDays(nextStart, periodLen - 1), predicted: true },
  ]

  return phases.map((p) => ({ ...p, current: today >= p.from && today <= p.to }))
}

// Позначки для клітинок календаря: множини днів-початків, днів-кінців, днів
// менструації та прогнозованих днів (apiDate-рядки "YYYY-MM-DD").
export function buildCalendarMarks(records, forecast, stats) {
  const starts = new Set()
  const ends = new Set()
  const period = new Set()
  const predicted = new Set()
  const today = todayApiDate()

  for (const r of records) {
    starts.add(r.startDate)
    const last = r.endDate ?? (r.startDate <= today ? today : r.startDate)
    if (r.endDate) ends.add(r.endDate)
    let cursor = r.startDate
    // усі дні від початку до кінця (або до сьогодні, якщо цикл триває) — менструація
    for (let guard = 0; cursor <= last && guard < 40; guard++) {
      period.add(cursor)
      cursor = addApiDays(cursor, 1)
    }
  }

  if (stats?.hasData && forecast?.predictedDate) {
    const periodLen = stats.avgPeriodLength ?? DEFAULT_PERIOD_LENGTH
    let cursor = forecast.predictedDate
    for (let i = 0; i < periodLen; i++) {
      predicted.add(cursor)
      cursor = addApiDays(cursor, 1)
    }
  }

  return { starts, ends, period, predicted }
}

export function getCycleStock() {
  try {
    const raw = localStorage.getItem(STOCK_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_STOCK_ITEMS
  } catch {
    return DEFAULT_STOCK_ITEMS
  }
}

export function setCycleStockState(id, state) {
  const items = getCycleStock().map((item) => (item.id === id ? { ...item, state } : item))
  localStorage.setItem(STOCK_KEY, JSON.stringify(items))
  return items
}
