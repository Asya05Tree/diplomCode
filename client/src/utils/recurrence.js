import { addMonths, fromApiDate, formatTime, toApiDate } from './date'

// Кодування/декодування WeekDaysPattern ("0:1,3|1:4,5" — індекс тижня в циклі : ISO-дні 1=Пн..7=Нд).

export function encodeWeekDaysPattern(weekPattern) {
  return weekPattern
    .map((daysSet, weekIndex) => ({ weekIndex, days: Array.from(daysSet).sort((a, b) => a - b) }))
    .filter(({ days }) => days.length > 0)
    .map(({ weekIndex, days }) => `${weekIndex}:${days.join(',')}`)
    .join('|')
}

export function decodeWeekDaysPattern(pattern, cycleWeeks) {
  const result = Array.from({ length: cycleWeeks }, () => new Set())
  if (!pattern) return result

  for (const part of pattern.split('|')) {
    const [weekIndexStr, daysStr] = part.split(':')
    const weekIndex = Number(weekIndexStr)
    if (Number.isNaN(weekIndex) || weekIndex < 0 || weekIndex >= cycleWeeks) continue
    result[weekIndex] = new Set((daysStr ?? '').split(',').filter(Boolean).map(Number))
  }

  return result
}

// planner-spec.md §3.3: термін дії правила — максимум рік, за замовчуванням пропонується 3 місяці
export const MAX_RECURRENCE_YEARS = 1
export const DEFAULT_END_MONTHS = 3

export function createDefaultRecurrenceValue(initialDate) {
  const start = toApiDate(initialDate)
  return {
    type: 'WeekCycle',
    time: formatTime(initialDate),
    startDate: start,
    endDate: toApiDate(addMonths(initialDate, DEFAULT_END_MONTHS)),
    cycleWeeks: 1,
    cycleAnchorDate: start,
    weekPattern: [new Set()],
    intervalDays: 1,
    monthDayMode: 'Specific',
    monthDays: new Set(),
  }
}

export function ruleToRecurrenceValue(rule) {
  const cycleWeeks = rule.cycleWeeks ?? 1
  return {
    type: rule.type,
    time: rule.timeOfDay.slice(0, 5),
    startDate: rule.startDate,
    endDate: rule.endDate,
    cycleWeeks,
    cycleAnchorDate: rule.cycleAnchorDate ?? rule.startDate,
    weekPattern: decodeWeekDaysPattern(rule.weekDaysPattern, cycleWeeks),
    intervalDays: rule.intervalDays ?? 1,
    monthDayMode: rule.monthDayMode ?? 'Specific',
    monthDays: new Set((rule.monthDays ?? '').split(',').filter(Boolean).map(Number)),
  }
}

export function recurrenceValueToPayload(value) {
  return {
    type: value.type,
    timeOfDay: `${value.time}:00`,
    startDate: value.startDate,
    endDate: value.endDate,
    cycleWeeks: value.type === 'WeekCycle' ? value.cycleWeeks : null,
    cycleAnchorDate: value.type === 'WeekCycle' && value.cycleWeeks > 1 ? value.cycleAnchorDate : null,
    weekDaysPattern: value.type === 'WeekCycle' ? encodeWeekDaysPattern(value.weekPattern) : null,
    intervalDays: value.type === 'EveryNDays' ? value.intervalDays : null,
    monthDayMode: value.type === 'MonthDays' ? value.monthDayMode : null,
    monthDays: value.type === 'MonthDays' && value.monthDayMode === 'Specific'
      ? Array.from(value.monthDays).sort((a, b) => a - b).join(',')
      : null,
  }
}

// Повертає код помилки (для перекладу в компоненті) або null, якщо все гаразд
export function validateRecurrenceValue(value) {
  const maxEndDate = toApiDate(addMonths(fromApiDate(value.startDate), 12 * MAX_RECURRENCE_YEARS))
  if (!value.endDate || value.endDate < value.startDate || value.endDate > maxEndDate) {
    return 'errorEndDateTooFar'
  }

  if (value.type === 'WeekCycle') {
    const hasAnyDay = value.weekPattern.some((set) => set.size > 0)
    if (!hasAnyDay) return 'errorWeekdaysRequired'
  }

  if (value.type === 'EveryNDays' && (!value.intervalDays || value.intervalDays < 1)) {
    return 'errorIntervalRequired'
  }

  if (value.type === 'MonthDays' && value.monthDayMode === 'Specific' && value.monthDays.size === 0) {
    return 'errorMonthDaysRequired'
  }

  return null
}
