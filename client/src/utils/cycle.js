import { fromApiDate, toApiDate, addDays, startOfDay } from './date'

const DEFAULT_PERIOD_LENGTH = 6
const MAX_DAYS_GUARD = 400

// Середня тривалість менструації з реальних записів (із відміченим кінцем); без даних — орієнтовно 6.
function avgPeriodLength(records) {
  const lens = records
    .filter((r) => r.startDate && r.endDate)
    .map((r) => Math.round((fromApiDate(r.endDate) - fromApiDate(r.startDate)) / 86400000) + 1)
  if (lens.length === 0) return DEFAULT_PERIOD_LENGTH
  return Math.round(lens.reduce((s, n) => s + n, 0) / lens.length)
}

// "Важкі дні" = дні менструації: зафіксовані (start..end, відкритий період — до сьогодні) плюс
// прогнозоване вікно наступної менструації (predictedDate .. +тривалість-1). Повертає Set рядків
// apiDate "YYYY-MM-DD". Використовується, щоб мʼяко нагадати про відпочинок, коли увімкнено
// "знижувати навантаження у важкі дні" (налаштування Циклу, planner-spec §3.7).
export function buildHeavyDays(records = [], forecast = null) {
  const set = new Set()
  const today = startOfDay(new Date())

  for (const r of records) {
    if (!r.startDate) continue
    let d = fromApiDate(r.startDate)
    const end = r.endDate ? fromApiDate(r.endDate) : today // відкритий період — до сьогодні
    for (let guard = 0; d <= end && guard < MAX_DAYS_GUARD; guard++) {
      set.add(toApiDate(d))
      d = addDays(d, 1)
    }
  }

  if (forecast?.predictedDate) {
    const periodLen = avgPeriodLength(records)
    let d = fromApiDate(forecast.predictedDate)
    for (let i = 0; i < periodLen; i++) {
      set.add(toApiDate(d))
      d = addDays(d, 1)
    }
  }

  return set
}
