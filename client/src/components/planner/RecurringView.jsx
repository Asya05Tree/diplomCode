import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import TaskForm from './TaskForm'
import {
  getRecurrenceRules,
  updateRecurrenceRule,
  deleteRecurrenceRule,
  previewRecurrenceRule,
  addException,
  deleteException,
} from '../../api/tasks'
import './RecurringView.css'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

function summarizeRule(rule, t) {
  const weekdayLabels = t('planner.weekdaysShort').split(',')
  const patternLabel = t(`taskForm.pattern.${rule.pattern.toLowerCase()}`)
  const time = rule.timeOfDay.slice(0, 5)
  if (rule.pattern === 'Weekly' && rule.daysOfWeek) {
    const days = rule.daysOfWeek
      .split(',')
      .map(Number)
      .sort((a, b) => a - b)
      .map((d) => weekdayLabels[d - 1])
      .join(', ')
    return `${patternLabel} · ${days} · ${time}`
  }
  return `${patternLabel} · ${time}`
}

// planner-spec.md §4.3 "Повторювані" — список правил + форма редагування обраного (дні тижня,
// час, період дії, винятки). Прев'ю обраного правила прокидається наверх у ліву сітку (§4.4).
export default function RecurringView({ token, visibleRange, onPreviewChange }) {
  const { t } = useI18n()
  const weekdayLabels = t('planner.weekdaysShort').split(',')

  const [rules, setRules] = useState([])
  const [version, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)

  const [selectedId, setSelectedId] = useState(null)
  const [editState, setEditState] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')

  const [showAddException, setShowAddException] = useState(false)
  const [exceptionDate, setExceptionDate] = useState('')
  const [exceptionType, setExceptionType] = useState('Cancelled')
  const [exceptionNewDate, setExceptionNewDate] = useState('')
  const [exceptionNewTime, setExceptionNewTime] = useState('09:00')

  useEffect(() => {
    getRecurrenceRules(token)
      .then((list) => {
        setRules(list)
        setSelectedId((current) => (current && list.some((r) => r.id === current) ? current : null))
      })
      .catch(() => setRules([]))
  }, [token, version])

  const selected = rules.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) {
      onPreviewChange(new Map())
      return
    }
    previewRecurrenceRule(token, selected.id, visibleRange.from, visibleRange.to)
      .then((entries) => {
        const map = new Map()
        for (const entry of entries) map.set(entry.date, entry.type)
        onPreviewChange(map)
      })
      .catch(() => onPreviewChange(new Map()))
  }, [selected, visibleRange, token, onPreviewChange])

  const selectRule = (rule) => {
    setSelectedId(rule.id)
    setError('')
    setShowAddException(false)
    setEditState({
      title: rule.title,
      description: rule.description ?? '',
      durationMinutes: rule.durationMinutes ?? '',
      pattern: rule.pattern,
      daysOfWeek: new Set((rule.daysOfWeek ?? '').split(',').filter(Boolean).map(Number)),
      timeOfDay: rule.timeOfDay.slice(0, 5),
      startDate: rule.startDate,
      endDate: rule.endDate ?? '',
      noEndDate: !rule.endDate,
    })
  }

  const toggleEditDay = (day) => {
    const next = new Set(editState.daysOfWeek)
    if (next.has(day)) next.delete(day)
    else next.add(day)
    setEditState({ ...editState, daysOfWeek: next })
  }

  const handleSaveEdit = async () => {
    if (!editState.title.trim()) {
      setError(t('taskForm.errorTitleRequired'))
      return
    }
    if (editState.pattern === 'Weekly' && editState.daysOfWeek.size === 0) {
      setError(t('taskForm.errorWeekdaysRequired'))
      return
    }
    setError('')
    try {
      await updateRecurrenceRule(token, selectedId, {
        title: editState.title.trim(),
        description: editState.description.trim() || null,
        durationMinutes: editState.durationMinutes ? Number(editState.durationMinutes) : null,
        pattern: editState.pattern,
        daysOfWeek: editState.pattern === 'Weekly' ? Array.from(editState.daysOfWeek).sort().join(',') : null,
        timeOfDay: `${editState.timeOfDay}:00`,
        startDate: editState.startDate,
        endDate: editState.noEndDate ? null : editState.endDate || null,
      })
      bump()
    } catch {
      setError(t('taskForm.errorSave'))
    }
  }

  const handleDeleteRule = async () => {
    await deleteRecurrenceRule(token, selectedId)
    setSelectedId(null)
    setEditState(null)
    bump()
  }

  const canSubmitException =
    Boolean(exceptionDate) && (exceptionType === 'Cancelled' || (exceptionType === 'Moved' && exceptionNewDate))

  const handleAddException = async () => {
    if (!canSubmitException) return
    await addException(token, selectedId, {
      date: exceptionDate,
      exceptionType,
      newDateTime: exceptionType === 'Moved' ? `${exceptionNewDate}T${exceptionNewTime}:00` : null,
    })
    setShowAddException(false)
    setExceptionDate('')
    setExceptionNewDate('')
    bump()
  }

  const handleDeleteException = async (exceptionId) => {
    await deleteException(token, selectedId, exceptionId)
    bump()
  }

  return (
    <div className="recurring-view">
      <div className="recurring-view-header">
        <h3>{t('planner.rules')}</h3>
        <button
          type="button"
          className="day-view-add"
          onClick={() => {
            setShowCreate((s) => !s)
            setSelectedId(null)
          }}
        >
          {t('planner.newRule')}
        </button>
      </div>

      {showCreate && (
        <TaskForm
          token={token}
          initialDate={new Date()}
          defaultRecurring
          onSaved={() => {
            setShowCreate(false)
            bump()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {rules.length === 0 ? (
        <p className="placeholder-text">{t('planner.noRules')}</p>
      ) : (
        <div className="recurring-view-list">
          {rules.map((rule) => (
            <button
              key={rule.id}
              type="button"
              className={rule.id === selectedId ? 'recurring-rule-card recurring-rule-card--active' : 'recurring-rule-card'}
              onClick={() => selectRule(rule)}
            >
              <span className="recurring-rule-title">{rule.title}</span>
              <span className="recurring-rule-summary">{summarizeRule(rule, t)}</span>
            </button>
          ))}
        </div>
      )}

      {selected && editState && (
        <div className="recurring-edit card">
          <h4>{t('planner.editRule')}</h4>

          <label>
            {t('taskForm.titleLabel')}
            <input value={editState.title} onChange={(e) => setEditState({ ...editState, title: e.target.value })} />
          </label>

          <div className="task-form-row">
            <label>
              <select value={editState.pattern} onChange={(e) => setEditState({ ...editState, pattern: e.target.value })}>
                <option value="Daily">{t('taskForm.pattern.daily')}</option>
                <option value="Weekly">{t('taskForm.pattern.weekly')}</option>
                <option value="Monthly">{t('taskForm.pattern.monthly')}</option>
              </select>
            </label>
            <label>
              {t('taskForm.time')}
              <input
                type="time"
                value={editState.timeOfDay}
                onChange={(e) => setEditState({ ...editState, timeOfDay: e.target.value })}
              />
            </label>
          </div>

          {editState.pattern === 'Weekly' && (
            <div className="task-form-weekdays">
              <span>{t('taskForm.weekdays')}</span>
              <div className="task-form-weekdays-list">
                {WEEKDAYS.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    className={editState.daysOfWeek.has(day) ? 'task-form-weekday task-form-weekday--active' : 'task-form-weekday'}
                    onClick={() => toggleEditDay(day)}
                  >
                    {weekdayLabels[idx]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="task-form-row">
            <label>
              {t('taskForm.startDate')}
              <input
                type="date"
                value={editState.startDate}
                onChange={(e) => setEditState({ ...editState, startDate: e.target.value })}
              />
            </label>
            <label className="task-form-checkbox">
              <input
                type="checkbox"
                checked={editState.noEndDate}
                onChange={(e) => setEditState({ ...editState, noEndDate: e.target.checked })}
              />
              {t('taskForm.noEndDate')}
            </label>
            {!editState.noEndDate && (
              <label>
                {t('taskForm.endDate')}
                <input
                  type="date"
                  value={editState.endDate}
                  onChange={(e) => setEditState({ ...editState, endDate: e.target.value })}
                />
              </label>
            )}
          </div>

          <label>
            {t('taskForm.duration')}
            <input
              type="number"
              min="1"
              value={editState.durationMinutes}
              onChange={(e) => setEditState({ ...editState, durationMinutes: e.target.value })}
            />
          </label>

          {error && <p className="task-form-error">{error}</p>}

          <div className="task-form-actions">
            <button type="button" className="task-form-submit" onClick={handleSaveEdit}>
              {t('taskForm.save')}
            </button>
            <button type="button" className="task-item-action task-item-action--danger" onClick={handleDeleteRule}>
              {t('recurrence.deleteRule')}
            </button>
          </div>

          <div className="recurring-exceptions">
            <h4>{t('recurrence.exceptions')}</h4>

            {selected.exceptions.length === 0 && !showAddException && <p className="placeholder-text">—</p>}

            {selected.exceptions.map((ex) => (
              <div key={ex.id} className="recurring-exception-row">
                <span>
                  {ex.date} — {ex.exceptionType === 'Cancelled' ? t('recurrence.exceptionCancelled') : t('recurrence.exceptionMoved')}
                  {ex.exceptionType === 'Moved' && ex.newDateTime && ` → ${ex.newDateTime.replace('T', ' ').slice(0, 16)}`}
                </span>
                <button
                  type="button"
                  className="task-item-action task-item-action--danger"
                  onClick={() => handleDeleteException(ex.id)}
                >
                  {t('recurrence.deleteException')}
                </button>
              </div>
            ))}

            {showAddException ? (
              <div className="recurring-exception-form">
                <input type="date" value={exceptionDate} onChange={(e) => setExceptionDate(e.target.value)} />
                <select value={exceptionType} onChange={(e) => setExceptionType(e.target.value)}>
                  <option value="Cancelled">{t('recurrence.exceptionCancelled')}</option>
                  <option value="Moved">{t('recurrence.exceptionMoved')}</option>
                </select>
                {exceptionType === 'Moved' && (
                  <>
                    <input type="date" value={exceptionNewDate} onChange={(e) => setExceptionNewDate(e.target.value)} />
                    <input type="time" value={exceptionNewTime} onChange={(e) => setExceptionNewTime(e.target.value)} />
                  </>
                )}
                <button type="button" onClick={handleAddException} disabled={!canSubmitException}>
                  {t('taskForm.save')}
                </button>
                <button type="button" onClick={() => setShowAddException(false)}>
                  {t('taskForm.cancel')}
                </button>
              </div>
            ) : (
              <button type="button" className="day-view-add" onClick={() => setShowAddException(true)}>
                {t('recurrence.addException')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
