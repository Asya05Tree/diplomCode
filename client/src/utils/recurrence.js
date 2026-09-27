// Кодування/декодування WeekDaysPattern ("0:1,3|1:4,5" — індекс тижня в циклі : ISO-дні 1=Пн..7=Нд).
// Окремо від utils/date.js — це формат зберігання патерну, а не дата.

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
