import { useI18n } from '../../i18n'
import { addMonths, fromApiDate, toApiDate } from '../../utils/date'
import { MAX_RECURRENCE_YEARS } from '../../utils/recurrence'
import './RecurrenceFields.css'

const TYPES = ['WeekCycle', 'EveryNDays', 'MonthDays', 'Manual']
const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7]
const MONTH_DAY_MODES = ['Specific', 'Even', 'Odd', 'LastDay']

// planner-spec.md §3.3 — спільна форма для всіх чотирьох типів правил повторення.
// Керований компонент: value/onChange, форма самого value описана в utils/recurrence.js.
export default function RecurrenceFields({ value, onChange }) {
  const { t } = useI18n()
  const weekdayLabels = t('planner.weekdaysShort').split(',')
  const maxEndDate = toApiDate(addMonths(fromApiDate(value.startDate), 12 * MAX_RECURRENCE_YEARS))

  const set = (patch) => onChange({ ...value, ...patch })

  const setCycleWeeks = (n) => {
    const nextPattern = Array.from({ length: n }, (_, i) => value.weekPattern[i] ?? new Set())
    set({ cycleWeeks: n, weekPattern: nextPattern })
  }

  const toggleWeekDay = (weekIndex, day) => {
    const nextPattern = value.weekPattern.map((daysSet, i) => {
      if (i !== weekIndex) return daysSet
      const next = new Set(daysSet)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
    set({ weekPattern: nextPattern })
  }

  const toggleMonthDay = (day) => {
    const next = new Set(value.monthDays)
    if (next.has(day)) next.delete(day)
    else next.add(day)
    set({ monthDays: next })
  }

  const handleStartDateChange = (startDate) => {
    // Дата закінчення й дата відліку циклу не можуть опинитись раніше нового початку
    const patch = { startDate }
    if (value.endDate < startDate) patch.endDate = startDate
    if (value.cycleAnchorDate && value.cycleAnchorDate < startDate) patch.cycleAnchorDate = startDate
    set(patch)
  }

  return (
    <div className="recurrence-fields">
      <div className="recurrence-type-row">
        {TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={value.type === type ? 'recurrence-type-btn recurrence-type-btn--active' : 'recurrence-type-btn'}
            onClick={() => set({ type })}
          >
            {t(`recurrence.type.${type}`)}
          </button>
        ))}
      </div>

      {value.type === 'WeekCycle' && (
        <div className="recurrence-week-cycle">
          <div className="task-form-row">
            <label>
              {t('recurrence.cycleWeeks')}
              <select value={value.cycleWeeks} onChange={(e) => setCycleWeeks(Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>

            {value.cycleWeeks > 1 && (
              <label>
                {t('recurrence.anchorDate')}
                <input
                  type="date"
                  value={value.cycleAnchorDate}
                  min={value.startDate}
                  onChange={(e) => set({ cycleAnchorDate: e.target.value })}
                />
              </label>
            )}
          </div>

          <div className="recurrence-week-grid">
            {value.weekPattern.map((daysSet, weekIndex) => (
              <div key={weekIndex} className="recurrence-week-row">
                {value.cycleWeeks > 1 && (
                  <span className="recurrence-week-row-label">{t('recurrence.week', { n: weekIndex + 1 })}</span>
                )}
                <div className="recurrence-week-row-days">
                  {ISO_DAYS.map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      className={daysSet.has(day) ? 'task-form-weekday task-form-weekday--active' : 'task-form-weekday'}
                      onClick={() => toggleWeekDay(weekIndex, day)}
                    >
                      {weekdayLabels[idx]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {value.type === 'EveryNDays' && (
        <label>
          {t('recurrence.intervalDays')}
          <input
            type="number"
            min="1"
            value={value.intervalDays}
            onChange={(e) => set({ intervalDays: Number(e.target.value) || 1 })}
          />
        </label>
      )}

      {value.type === 'MonthDays' && (
        <div className="recurrence-month-days">
          <div className="recurrence-type-row">
            {MONTH_DAY_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={value.monthDayMode === mode ? 'recurrence-type-btn recurrence-type-btn--active' : 'recurrence-type-btn'}
                onClick={() => set({ monthDayMode: mode })}
              >
                {t(`recurrence.monthDayMode.${mode}`)}
              </button>
            ))}
          </div>

          {value.monthDayMode === 'Specific' && (
            <div className="recurrence-month-grid">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  className={value.monthDays.has(day) ? 'recurrence-month-cell recurrence-month-cell--active' : 'recurrence-month-cell'}
                  onClick={() => toggleMonthDay(day)}
                >
                  {day}
                </button>
              ))}
            </div>
          )}

          {(value.monthDayMode === 'Even' || value.monthDayMode === 'Odd') && (
            <p className="recurrence-hint">{t('recurrence.monthDaysHint')}</p>
          )}
        </div>
      )}

      {value.type === 'Manual' && <p className="recurrence-hint">{t('recurrence.manualHint')}</p>}

      <div className="task-form-row">
        <label>
          {t('taskForm.startDate')}
          <input type="date" value={value.startDate} onChange={(e) => handleStartDateChange(e.target.value)} />
        </label>
        <label>
          {t('taskForm.endDate')} <span className="task-form-hint">({t('taskForm.endDateHint')})</span>
          <input
            type="date"
            value={value.endDate}
            min={value.startDate}
            max={maxEndDate}
            onChange={(e) => set({ endDate: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
