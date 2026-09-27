import { useState } from 'react'
import { useI18n } from '../../i18n'
import { createTask, createRecurrenceRule } from '../../api/tasks'
import { addMonths, fromApiDate, toApiDate, toApiDateTime, formatTime } from '../../utils/date'
import './TaskForm.css'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] // Пн..Нд — та сама кодировка, що й на бекенді
// Без обмеження дата закінчення могла б поповзти на роки вперед — обмежуємо розумним горизонтом
// (планування на пів року вперед уже покриває більшість розкладів: пари, тренування, зміни)
const MAX_RECURRENCE_MONTHS = 6

// Спільна форма створення задачі, за шаблоном coding-guide.md §8: назва, коли (один раз /
// повторюється: патерн + дні/час/період), тривалість і дедлайн — необов'язкові.
export default function TaskForm({ token, initialDate, defaultRecurring = false, onSaved, onCancel }) {
  const { t } = useI18n()
  const weekdayLabels = t('planner.weekdaysShort').split(',')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [repeats, setRepeats] = useState(defaultRecurring)
  const [date, setDate] = useState(toApiDate(initialDate))
  const [time, setTime] = useState(formatTime(initialDate))
  const [duration, setDuration] = useState('')
  const [deadline, setDeadline] = useState('')

  const [pattern, setPattern] = useState('Weekly')
  const [selectedDays, setSelectedDays] = useState(new Set())
  const [endDate, setEndDate] = useState('')
  const [noEndDate, setNoEndDate] = useState(true)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const maxEndDate = toApiDate(addMonths(fromApiDate(date), MAX_RECURRENCE_MONTHS))

  const toggleDay = (day) => {
    setSelectedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!title.trim()) {
      setError(t('taskForm.errorTitleRequired'))
      return
    }
    if (repeats && pattern === 'Weekly' && selectedDays.size === 0) {
      setError(t('taskForm.errorWeekdaysRequired'))
      return
    }
    if (repeats && !noEndDate && endDate && endDate > maxEndDate) {
      setError(t('taskForm.errorEndDateTooFar'))
      return
    }

    setBusy(true)
    try {
      if (repeats) {
        const rule = await createRecurrenceRule(token, {
          title: title.trim(),
          description: description.trim() || null,
          durationMinutes: duration ? Number(duration) : null,
          pattern,
          daysOfWeek: pattern === 'Weekly' ? Array.from(selectedDays).sort().join(',') : null,
          timeOfDay: `${time}:00`,
          startDate: date,
          endDate: noEndDate ? null : endDate || null,
        })
        onSaved(rule)
      } else {
        const [y, m, d] = date.split('-').map(Number)
        const [h, min] = time.split(':').map(Number)
        const startDateTime = toApiDateTime(new Date(y, m - 1, d, h, min))
        const deadlineDateTime = deadline ? `${deadline}T23:59:00` : null

        const created = await createTask(token, {
          title: title.trim(),
          description: description.trim() || null,
          startDateTime,
          durationMinutes: duration ? Number(duration) : null,
          deadline: deadlineDateTime,
        })
        onSaved(created)
      }
    } catch {
      setError(t('taskForm.errorSave'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <label>
        {t('taskForm.titleLabel')}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('taskForm.titlePlaceholder')} required />
      </label>

      <label>
        {t('taskForm.description')}
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>

      <div className="task-form-when">
        <span className="task-form-when-label">{t('taskForm.when')}</span>
        <label className="task-form-radio">
          <input type="radio" checked={!repeats} onChange={() => setRepeats(false)} />
          {t('taskForm.once')}
        </label>
        <label className="task-form-radio">
          <input type="radio" checked={repeats} onChange={() => setRepeats(true)} />
          {t('taskForm.repeats')}
        </label>
        {repeats && (
          <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
            <option value="Daily">{t('taskForm.pattern.daily')}</option>
            <option value="Weekly">{t('taskForm.pattern.weekly')}</option>
            <option value="Monthly">{t('taskForm.pattern.monthly')}</option>
          </select>
        )}
      </div>

      {repeats && pattern === 'Weekly' && (
        <div className="task-form-weekdays">
          <span>{t('taskForm.weekdays')}</span>
          <div className="task-form-weekdays-list">
            {WEEKDAYS.map((day, idx) => (
              <button
                key={day}
                type="button"
                className={selectedDays.has(day) ? 'task-form-weekday task-form-weekday--active' : 'task-form-weekday'}
                onClick={() => toggleDay(day)}
              >
                {weekdayLabels[idx]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="task-form-row">
        <label>
          {repeats ? t('taskForm.startDate') : t('taskForm.date')}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          {t('taskForm.time')}
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
      </div>

      {repeats && (
        <div className="task-form-row">
          <label className="task-form-checkbox">
            <input type="checkbox" checked={noEndDate} onChange={(e) => setNoEndDate(e.target.checked)} />
            {t('taskForm.noEndDate')}
          </label>
          {!noEndDate && (
            <label>
              {t('taskForm.endDate')} <span className="task-form-hint">({t('taskForm.endDateHint')})</span>
              <input
                type="date"
                value={endDate}
                min={date}
                max={maxEndDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          )}
        </div>
      )}

      <div className="task-form-row">
        <label>
          {t('taskForm.duration')}
          <input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>
        {!repeats && (
          <label>
            {t('taskForm.deadline')}
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        )}
      </div>

      {error && <p className="task-form-error">{error}</p>}

      <div className="task-form-actions">
        <button type="submit" className="task-form-submit" disabled={busy}>{t('taskForm.save')}</button>
        <button type="button" className="task-form-cancel" onClick={onCancel}>{t('taskForm.cancel')}</button>
      </div>
    </form>
  )
}
