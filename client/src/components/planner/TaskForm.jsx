import { useState } from 'react'
import { useI18n } from '../../i18n'
import { createTask, createRecurrenceRule } from '../../api/tasks'
import { toApiDate, toApiDateTime, formatTime, todayApiDate } from '../../utils/date'
import { createDefaultRecurrenceValue, recurrenceValueToPayload, validateRecurrenceValue } from '../../utils/recurrence'
import RecurrenceFields from './RecurrenceFields'
import './TaskForm.css'

// Спільна форма створення задачі, за шаблоном coding-guide.md §8: назва, коли (один раз /
// повторюється — тип правила й розклад делегуються RecurrenceFields), тривалість і дедлайн — необов'язкові.
export default function TaskForm({ token, initialDate, defaultRecurring = false, onSaved, onCancel }) {
  const { t } = useI18n()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [repeats, setRepeats] = useState(defaultRecurring)
  const [date, setDate] = useState(toApiDate(initialDate))
  const [time, setTime] = useState(formatTime(initialDate))
  const [duration, setDuration] = useState('')
  const [deadline, setDeadline] = useState('')

  const [recurrence, setRecurrence] = useState(() => createDefaultRecurrenceValue(initialDate))

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!title.trim()) {
      setError(t('taskForm.errorTitleRequired'))
      return
    }
    if (repeats) {
      const errorCode = validateRecurrenceValue(recurrence)
      if (errorCode) {
        setError(t(`taskForm.${errorCode}`))
        return
      }
      if (recurrence.startDate < todayApiDate()) {
        setError(t('taskForm.errorStartDateInPast'))
        return
      }
    } else if (date < todayApiDate()) {
      setError(t('taskForm.errorDateInPast'))
      return
    }

    setBusy(true)
    try {
      if (repeats) {
        const rule = await createRecurrenceRule(token, {
          title: title.trim(),
          description: description.trim() || null,
          durationMinutes: duration ? Number(duration) : null,
          ...recurrenceValueToPayload(recurrence),
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
      </div>

      {repeats ? (
        <RecurrenceFields value={recurrence} onChange={setRecurrence} />
      ) : (
        <div className="task-form-row">
          <label>
            {t('taskForm.date')}
            <input type="date" value={date} min={todayApiDate()} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            {t('taskForm.time')}
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>
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
            <input type="date" value={deadline} min={todayApiDate()} onChange={(e) => setDeadline(e.target.value)} />
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
