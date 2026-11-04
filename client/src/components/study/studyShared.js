// Спільні константи й маленькі хелпери модуля "Навчання".

export const LEARNING_FORMS = ['distance', 'regular', 'mixed']
export const DEADLINE_KINDS = ['semester', 'year', 'week', 'tomorrow', 'date']
export const PUPIL_ASSIGNMENT_TYPES = ['homework']
export const STUDENT_ASSIGNMENT_TYPES = ['lab', 'exam', 'practical'] // lab — за замовчуванням
export const PROJECT_KINDS = ['diploma', 'coursework', 'practice']
export const ENTRY_FORM_KINDS = ['consultation', 'elective']

// Факультативи — лише для школярів; у студентів лишаються тільки консультації.
export function entryKindsFor(isPupil) {
  return isPupil ? ENTRY_FORM_KINDS : ['consultation']
}

// Типові назви предметів — підказки для поля "Назва предмета" (datalist, вільний ввід лишається).
export const SUBJECT_PRESETS = [
  { uk: 'Українська мова', en: 'Ukrainian language' },
  { uk: 'Українська література', en: 'Ukrainian literature' },
  { uk: 'Зарубіжна література', en: 'World literature' },
  { uk: 'Математика', en: 'Mathematics' },
  { uk: 'Алгебра', en: 'Algebra' },
  { uk: 'Геометрія', en: 'Geometry' },
  { uk: 'Природознавство', en: 'Natural science' },
  { uk: 'Біологія', en: 'Biology' },
  { uk: 'Географія', en: 'Geography' },
  { uk: 'Фізика', en: 'Physics' },
  { uk: 'Хімія', en: 'Chemistry' },
  { uk: 'Історія України', en: 'History of Ukraine' },
  { uk: 'Всесвітня історія', en: 'World history' },
  { uk: 'Правознавство', en: 'Law studies' },
  { uk: 'Інформатика', en: 'Computer science' },
  { uk: 'Англійська мова', en: 'English language' },
  { uk: 'Німецька мова', en: 'German language' },
  { uk: 'Фізична культура', en: 'Physical education' },
  { uk: 'Трудове навчання', en: 'Labour studies' },
  { uk: 'Образотворче мистецтво', en: 'Fine art' },
  { uk: 'Музичне мистецтво', en: 'Music' },
  { uk: "Основи здоров'я", en: 'Health basics' },
  { uk: 'Громадянська освіта', en: 'Civic education' },
  { uk: 'Астрономія', en: 'Astronomy' },
  { uk: 'Економіка', en: 'Economics' },
]

// Яку пару полів показувати для форми навчання: кабінет (очне/змішане) і/або посилання (дист./змішане)
export function roomLinkVisibility(form) {
  return {
    showRoom: form === 'regular' || form === 'mixed',
    showLink: form === 'distance' || form === 'mixed',
  }
}

// Короткий опис "коли" для запису розкладу/консультації — з полів пов'язаного правила повторення.
// fmtClock — форматувач часу з useI18n (12/24); дефолт зрізає до "HH:MM" (24-годинний).
export function summarizeEntry(entry, t, weekdayLabels, fmtClock = (s) => (s || '').slice(0, 5)) {
  const time = fmtClock(entry.timeOfDay || '')
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
