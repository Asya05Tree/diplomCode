import { useI18n } from '../../i18n'
import { addMonths, fromApiDate, toApiDate, todayApiDate } from '../../utils/date'
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
    const nextPatternTimes = Array.from({ length: n }, (_, i) => value.weekPatternTimes[i] ?? {})
    set({ cycleWeeks: n, weekPattern: nextPattern, weekPatternTimes: nextPatternTimes })
  }

  const toggleWeekDay = (weekIndex, day) => {
    const willBeActive = !value.weekPattern[weekIndex].has(day)
    const nextPattern = value.weekPattern.map((daysSet, i) => {
      if (i !== weekIndex) return daysSet
      const next = new Set(daysSet)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
    const nextPatternTimes = value.weekPatternTimes.map((dayTimes, i) => {
      if (i !== weekIndex) return dayTimes
      const next = { ...dayTimes }
      if (willBeActive) next[day] = next[day] ?? value.time
      else delete next[day]
      return next
    })
    set({ weekPattern: nextPattern, weekPatternTimes: nextPatternTimes })
  }

  const setDayTime = (weekIndex, day, time) => {
    const nextPatternTimes = value.weekPatternTimes.map((dayTimes, i) =>
      (i === weekIndex ? { ...dayTimes, [day]: time } : dayTimes))
    set({ weekPatternTimes: nextPatternTimes })
  }

  // Перемикач "однаковий час" <-> "свій час на день": при переході на "свій" кожен уже
  // обраний день отримує поточний спільний час як стартове значення
  const setSameTimeForAll = (same) => {
    if (same) {
      set({ sameTimeForAll: true })
      return
    }
    const nextPatternTimes = value.weekPattern.map((daysSet, i) => {
      const next = { ...value.weekPatternTimes[i] }
      for (const day of daysSet) next[day] = next[day] ?? value.time
      return next
    })
    set({ sameTimeForAll: false, weekPatternTimes: nextPatternTimes })
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

          <div className="recurrence-time-mode-row">
            <span className={value.sameTimeForAll ? 'recurrence-time-mode-label recurrence-time-mode-label--active' : 'recurrence-time-mode-label'}>
              {t('recurrence.sameTimeForAll')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!value.sameTimeForAll}
              className={value.sameTimeForAll ? 'recurrence-switch' : 'recurrence-switch recurrence-switch--on'}
              onClick={() => setSameTimeForAll(!value.sameTimeForAll)}
            >
              <span className="recurrence-switch-knob" />
            </button>
            <span className={!value.sameTimeForAll ? 'recurrence-time-mode-label recurrence-time-mode-label--active' : 'recurrence-time-mode-label'}>
              {t('recurrence.customTimePerDay')}
            </span>
          </div>

          <div className="recurrence-week-grid">
            {value.weekPattern.map((daysSet, weekIndex) => (
              <div key={weekIndex} className="recurrence-week-row">
                {value.cycleWeeks > 1 && (
                  <span className="recurrence-week-row-label">{t('recurrence.week', { n: weekIndex + 1 })}</span>
                )}
                <div className="recurrence-week-row-days">
                  {ISO_DAYS.map((day, idx) => {
                    const active = daysSet.has(day)
                    return (
                      <div key={day} className="recurrence-weekday-cell">
                        <button
                          type="button"
                          className={active ? 'task-form-weekday task-form-weekday--active' : 'task-form-weekday'}
                          onClick={() => toggleWeekDay(weekIndex, day)}
                        >
                          {weekdayLabels[idx]}
                        </button>
                        {active && !value.sameTimeForAll && (
                          <input
                            type="time"
                            className="recurrence-weekday-time"
                            value={value.weekPatternTimes[weekIndex]?.[day] ?? value.time}
                            onChange={(e) => setDayTime(weekIndex, day, e.target.value)}
                          />
                        )}
                      </div>
                    )
                  })}
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
        {!(value.type === 'WeekCycle' && !value.sameTimeForAll) && (
          <label>
            {t('taskForm.time')}
            <input type="time" value={value.time} onChange={(e) => set({ time: e.target.value })} />
          </label>
        )}
        <label>
          {t('taskForm.startDate')}
          <input
            type="date"
            value={value.startDate}
            min={todayApiDate()}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
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
