import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import TaskForm from './TaskForm'
import RecurrenceFields from './RecurrenceFields'
import {
  getRecurrenceRules,
  updateRecurrenceRule,
  deleteRecurrenceRule,
  previewRecurrenceRule,
  addException,
  deleteException,
  addManualDate,
  deleteManualDate,
} from '../../api/tasks'
import { fromApiDate, toApiDate } from '../../utils/date'
import { recurrenceValueToPayload, ruleToRecurrenceValue, validateRecurrenceValue } from '../../utils/recurrence'
import './RecurringView.css'

function summarizeRule(rule, t) {
  const weekdayLabels = t('planner.weekdaysShort').split(',')
  const time = rule.timeOfDay.slice(0, 5)

  if (rule.type === 'WeekCycle') {
    const pattern = (rule.weekDaysPattern ?? '').split('|').filter(Boolean)
    if (rule.cycleWeeks === 1) {
      const days = pattern[0]?.split(':')[1] ?? ''
      const labels = days.split(',').filter(Boolean).map((d) => weekdayLabels[Number(d) - 1]).join(', ')
      return `${t('recurrence.type.WeekCycle')} · ${labels} · ${time}`
    }
    const weeks = pattern
      .map((part) => {
        const [weekIndex, days] = part.split(':')
        const labels = (days ?? '').split(',').filter(Boolean).map((d) => weekdayLabels[Number(d) - 1]).join(', ')
        return `${t('recurrence.week', { n: Number(weekIndex) + 1 })}: ${labels || '—'}`
      })
      .join(' · ')
    return `${t('recurrence.cycleWeeks')} ${rule.cycleWeeks} · ${weeks} · ${time}`
  }

  if (rule.type === 'EveryNDays') return `${t('recurrence.type.EveryNDays')} ${rule.intervalDays} · ${time}`

  if (rule.type === 'MonthDays') {
    if (rule.monthDayMode === 'Specific') return `${(rule.monthDays ?? '').split(',').join(', ')} · ${time}`
    return `${t(`recurrence.monthDayMode.${rule.monthDayMode}`)} · ${time}`
  }

  return `${t('recurrence.type.Manual')} · ${t('recurrence.manualDatesCount', { count: rule.manualDates.length })}`
}

// planner-spec.md §3.3, §4.3 "Повторювані" — список правил + форма редагування обраного.
// Прев'ю обраного правила прокидається наверх у ліву сітку (§4.4); для типу Manual та сама
// сітка стає засобом введення — клік по дню передається наверх через onManualHandlerChange.
export default function RecurringView({ token, visibleRange, onPreviewChange, onManualHandlerChange }) {
  const { t } = useI18n()

  const [rules, setRules] = useState([])
  const [version, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)

  const [selectedId, setSelectedId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editRecurrence, setEditRecurrence] = useState(null)
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

  // Тип Manual: ліва сітка сама стає формою введення — клік по дню додає/знімає дату
  useEffect(() => {
    if (!selected || selected.type !== 'Manual') {
      onManualHandlerChange(null)
      return
    }
    onManualHandlerChange(() => async (date) => {
      const key = toApiDate(date)
      if (selected.manualDates.includes(key)) await deleteManualDate(token, selected.id, date)
      else await addManualDate(token, selected.id, date)
      bump()
    })
  }, [selected, token, onManualHandlerChange])

  const selectRule = (rule) => {
    setSelectedId(rule.id)
    setError('')
    setShowAddException(false)
    setEditTitle(rule.title)
    setEditDescription(rule.description ?? '')
    setEditDuration(rule.durationMinutes ?? '')
    setEditRecurrence(ruleToRecurrenceValue(rule))
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setError(t('taskForm.errorTitleRequired'))
      return
    }
    const errorCode = validateRecurrenceValue(editRecurrence)
    if (errorCode) {
      setError(t(`taskForm.${errorCode}`))
      return
    }
    setError('')
    try {
      await updateRecurrenceRule(token, selectedId, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        durationMinutes: editDuration ? Number(editDuration) : null,
        ...recurrenceValueToPayload(editRecurrence),
      })
      bump()
    } catch {
      setError(t('taskForm.errorSave'))
    }
  }

  const handleDeleteRule = async () => {
    await deleteRecurrenceRule(token, selectedId)
    setSelectedId(null)
    setEditRecurrence(null)
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

  const handleRemoveManualDate = async (dateKey) => {
    await deleteManualDate(token, selectedId, fromApiDate(dateKey))
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

      {selected && editRecurrence && (
        <div className="recurring-edit card">
          <h4>{t('planner.editRule')}</h4>

          <label>
            {t('taskForm.titleLabel')}
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </label>

          <label>
            {t('taskForm.description')}
            <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
          </label>

          <RecurrenceFields value={editRecurrence} onChange={setEditRecurrence} />

          <label>
            {t('taskForm.duration')}
            <input
              type="number"
              min="1"
              value={editDuration}
              onChange={(e) => setEditDuration(e.target.value)}
            />
          </label>

          {selected.type === 'Manual' && (
            <div className="recurring-manual-dates">
              <span>{t('recurrence.manualDatesCount', { count: selected.manualDates.length })}</span>
              {selected.manualDates.length > 0 && (
                <div className="recurring-manual-dates-list">
                  {selected.manualDates.map((d) => (
                    <span key={d} className="recurring-manual-date-chip">
                      {d}
                      <button type="button" onClick={() => handleRemoveManualDate(d)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

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
