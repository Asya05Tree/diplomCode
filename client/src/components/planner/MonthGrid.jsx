import { useI18n } from '../../i18n'
import { getMonthGridCells, isSameDate, toApiDate } from '../../utils/date'
import Icon from '../Icon'
import './MonthGrid.css'

const LOCALE_BY_LANGUAGE = { uk: 'uk-UA', en: 'en-US' }

// Ліва частина планувальника (planner-spec.md §4.2). Заливка клітинок залежить від режиму —
// прокидається ззовні через markings, сітка сама знає лише про today/selected (§4.4: заливка
// поточного режиму ніколи не змішується з іншою).
export default function MonthGrid({ visibleMonth, onMonthChange, selectedDate, onSelectDate, markings, periodDays, workDays }) {
  const { t, language, weekStart, weekdays } = useI18n()
  const today = new Date()
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const cells = getMonthGridCells(year, month, weekStart)
  const weekdayLabels = weekdays
  const marks = markings ?? new Map()
  // Дні місячних — факт дня (не подія), показуємо краплею біля цифри
  const periods = periodDays ?? new Set()
  // Робочі дні (задачі/зміни з moduleCode="work") — позначаємо іконкою роботи
  const works = workDays ?? new Set()

  // Назва місяця + рік БЕЗ локального суфікса "р." (напр. "Листопад 2026", а не "листопад 2026 р.")
  const monthName = visibleMonth.toLocaleDateString(LOCALE_BY_LANGUAGE[language] ?? 'uk-UA', {
    month: 'long',
  })
  const monthLabel = `${monthName} ${year}`

  return (
    <div className="month-grid">
      <div className="month-grid-header">
        <button
          type="button"
          className="month-grid-nav"
          onClick={() => onMonthChange(new Date(year, month - 1, 1))}
          aria-label="prev-month"
          data-tooltip={t('planner.prevMonth')}
        >
          <Icon name="chevron-left" />
        </button>
        <span className="month-grid-title">{monthLabel}</span>
        <button
          type="button"
          className="month-grid-nav"
          onClick={() => onMonthChange(new Date(year, month + 1, 1))}
          aria-label="next-month"
          data-tooltip={t('planner.nextMonth')}
        >
          <Icon name="chevron-right" />
        </button>
      </div>

      <div className="month-grid-weekdays">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="month-grid-cells">
        {cells.map(({ date, inCurrentMonth }) => {
          const key = toApiDate(date)
          const mark = marks.get(key)
          const isPeriod = periods.has(key)
          const isWork = works.has(key)
          const classNames = ['month-grid-cell']
          if (!inCurrentMonth) classNames.push('month-grid-cell--outside')
          if (isSameDate(date, today)) classNames.push('month-grid-cell--today')
          if (selectedDate && isSameDate(date, selectedDate)) classNames.push('month-grid-cell--selected')
          if (mark) classNames.push(`month-grid-cell--${mark}`)
          if (isPeriod) classNames.push('month-grid-cell--period')

          return (
            <button key={key} type="button" className={classNames.join(' ')} onClick={() => onSelectDate(date)}>
              <span className="month-grid-cell-num">{date.getDate()}</span>
              {isWork && <Icon name="work" className="month-grid-cell-work" />}
              {isPeriod && <Icon name="drop" className="month-grid-cell-blood" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
