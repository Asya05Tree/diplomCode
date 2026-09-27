import { useI18n } from '../../i18n'
import { getMonthGridCells, isSameDate, toApiDate } from '../../utils/date'
import './MonthGrid.css'

const LOCALE_BY_LANGUAGE = { uk: 'uk-UA', en: 'en-US' }

// Ліва частина планувальника (planner-spec.md §4.2). Заливка клітинок залежить від режиму —
// прокидається ззовні через markings, сітка сама знає лише про today/selected (§4.4: заливка
// поточного режиму ніколи не змішується з іншою).
export default function MonthGrid({ visibleMonth, onMonthChange, selectedDate, onSelectDate, markings }) {
  const { t, language } = useI18n()
  const today = new Date()
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const cells = getMonthGridCells(year, month)
  const weekdayLabels = t('planner.weekdaysShort').split(',')
  const marks = markings ?? new Map()

  const monthLabel = visibleMonth.toLocaleDateString(LOCALE_BY_LANGUAGE[language] ?? 'uk-UA', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="month-grid">
      <div className="month-grid-header">
        <button type="button" onClick={() => onMonthChange(new Date(year, month - 1, 1))} aria-label="prev-month">
          ‹
        </button>
        <span className="month-grid-title">{monthLabel}</span>
        <button type="button" onClick={() => onMonthChange(new Date(year, month + 1, 1))} aria-label="next-month">
          ›
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
          const classNames = ['month-grid-cell']
          if (!inCurrentMonth) classNames.push('month-grid-cell--outside')
          if (isSameDate(date, today)) classNames.push('month-grid-cell--today')
          if (selectedDate && isSameDate(date, selectedDate)) classNames.push('month-grid-cell--selected')
          if (mark) classNames.push(`month-grid-cell--${mark}`)

          return (
            <button key={key} type="button" className={classNames.join(' ')} onClick={() => onSelectDate(date)}>
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
