// Спільні константи й маленькі хелпери модуля "Навчання".

export const LEARNING_FORMS = ['distance', 'regular', 'mixed']
export const DEADLINE_KINDS = ['semester', 'year', 'week', 'tomorrow', 'date']
export const PUPIL_ASSIGNMENT_TYPES = ['homework']
export const STUDENT_ASSIGNMENT_TYPES = ['lab', 'exam', 'practical'] // lab — за замовчуванням
export const PROJECT_KINDS = ['diploma', 'coursework', 'practice']
export const ENTRY_FORM_KINDS = ['consultation', 'elective']

// Яку пару полів показувати для форми навчання: кабінет (очне/змішане) і/або посилання (дист./змішане)
export function roomLinkVisibility(form) {
  return {
    showRoom: form === 'regular' || form === 'mixed',
    showLink: form === 'distance' || form === 'mixed',
  }
}

// Короткий опис "коли" для запису розкладу/консультації — з полів пов'язаного правила повторення.
export function summarizeEntry(entry, t, weekdayLabels) {
  const time = (entry.timeOfDay || '').slice(0, 5)
  if (entry.ruleType === 'WeekCycle') {
    // Дні згруповані по тижнях циклу у форматі "0:1,3|1:4,5"
    const byWeek = new Map()
    for (const part of (entry.weekDaysPattern ?? '').split('|').filter(Boolean)) {
      const [wk, list] = part.split(':')
      const days = (list ?? '').split(',').filter(Boolean).map(Number)
      byWeek.set(Number(wk), days)
    }
    const allDays = [...new Set([...byWeek.values()].flat())].sort((a, b) => a - b)
    const labels = allDays.map((d) => weekdayLabels[d - 1]).join(', ')
    const parity = (entry.cycleWeeks ?? 1) > 1 ? ` · ${t('study.cycleWeeksShort', { n: entry.cycleWeeks })}` : ''
    return `${labels || '—'}${parity}${time ? ` · ${time}` : ''}`
  }
  return `${t(`recurrence.type.${entry.ruleType}`)}${time ? ` · ${time}` : ''}`
}
