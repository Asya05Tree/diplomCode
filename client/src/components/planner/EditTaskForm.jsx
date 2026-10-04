import { useState } from 'react'
import { useI18n } from '../../i18n'
import { toApiDate, toApiDateTime, formatTime, fromApiDateTime, todayApiDate } from '../../utils/date'
import './TaskForm.css'

// Повне редагування одноразової задачі (назва/опис/дата/час/тривалість/дедлайн) — для
// повторюваних інстансів не використовується (назву/опис можна правити лише для правила цілком,
// §3.3 — тому тут завжди task без RecurrenceRuleId).
export default function EditTaskForm({ task, onSave, onCancel }) {
  const { t } = useI18n()
  const startDate = task.startDateTime ? fromApiDateTime(task.startDateTime) : new Date()

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [date, setDate] = useState(toApiDate(startDate))
  const [time, setTime] = useState(formatTime(startDate))
  const [duration, setDuration] = useState(task.durationMinutes ?? '')
  const [deadline, setDeadline] = useState(task.deadline ? toApiDate(fromApiDateTime(task.deadline)) : '')
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!title.trim()) {
      setError(t('taskForm.errorTitleRequired'))
      return
    }

    const [y, m, d] = date.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)

    onSave({
      title: title.trim(),
      description: description.trim() || null,
      startDateTime: toApiDateTime(new Date(y, m - 1, d, h, min)),
      durationMinutes: duration ? Number(duration) : null,
      deadline: deadline ? `${deadline}T23:59:00` : null,
    })
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <label>
        {t('taskForm.titleLabel')}
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <label>
        {t('taskForm.description')}
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>

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

      <div className="task-form-row">
        <label>
          {t('taskForm.duration')}
          <input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>
        <label>
          {t('taskForm.deadline')}
          <input type="date" value={deadline} min={todayApiDate()} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>

      {error && <p className="task-form-error">{error}</p>}

      <div className="task-form-actions">
        <button type="submit" className="task-form-submit">{t('taskForm.save')}</button>
        <button type="button" className="task-form-cancel" onClick={onCancel}>{t('taskForm.cancel')}</button>
      </div>
    </form>
  )
}
