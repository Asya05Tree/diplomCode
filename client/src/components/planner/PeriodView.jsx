import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import TaskItem from './TaskItem'
import EditTaskForm from './EditTaskForm'
import MoveTaskForm from './MoveTaskForm'
import OverlapGroup from './OverlapGroup'
import { getPeriodTasks, resolveTask, deleteTask, updateTask, addException } from '../../api/tasks'
import { addMonths, fromApiDateTime, toApiDate } from '../../utils/date'
import './PeriodView.css'

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Період не може бути довшим за місяць (вимога інтерфейсу): "по" завжди в межах
// [від, від+1міс], "з" — у межах [по-1міс, по]. Один і той самий день в обох полях дозволено.
function clampToAfterFrom(from, to) {
  if (to < from) return from
  const maxTo = addMonths(from, 1)
  return to > maxTo ? maxTo : to
}

function clampFromBeforeTo(from, to) {
  if (from > to) return to
  const minFrom = addMonths(to, -1)
  return from < minFrom ? minFrom : from
}

// planner-spec.md §4.3 "Період" — довільний діапазон дат. Заливка "де є задачі" тепер —
// базове відображення календаря (Planner.jsx), тут лишається тільки сам перелік завдань.
export default function PeriodView({ token, range, onRangeChange, onTasksChanged }) {
  const { t, language } = useI18n()
  const [tasks, setTasks] = useState([])
  const [movingTaskId, setMovingTaskId] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)

  const reload = useCallback(() => {
    if (range.from > range.to) {
      setTasks([])
      return
    }
    getPeriodTasks(token, range.from, range.to).then(setTasks).catch(() => setTasks([]))
  }, [token, range])

  useEffect(() => {
    reload()
  }, [reload])

  const handleResolve = async (id, action) => {
    await resolveTask(token, id, action)
    reload()
    onTasksChanged?.()
  }

  const handleDelete = async (id) => {
    await deleteTask(token, id)
    reload()
    onTasksChanged?.()
  }

  const handleCancelOccurrence = async (task) => {
    const occurrenceDate = toApiDate(fromApiDateTime(task.startDateTime))
    await addException(token, task.recurrenceRuleId, { date: occurrenceDate, exceptionType: 'Cancelled', newDateTime: null })
    reload()
    onTasksChanged?.()
  }

  const handleMove = async (task, startDateTime) => {
    if (task.isVirtual) {
      const occurrenceDate = toApiDate(fromApiDateTime(task.startDateTime))
      await addException(token, task.recurrenceRuleId, { date: occurrenceDate, exceptionType: 'Moved', newDateTime: startDateTime })
    } else {
      await updateTask(token, task.id, {
        title: task.title,
        description: task.description,
        startDateTime,
        durationMinutes: task.durationMinutes,
        deadline: task.deadline,
      })
    }
    setMovingTaskId(null)
    reload()
    onTasksChanged?.()
  }

  const handleSaveEdit = async (task, payload) => {
    await updateTask(token, task.id, payload)
    setEditingTaskId(null)
    reload()
    onTasksChanged?.()
  }

  const groups = useMemo(() => {
    const map = new Map()
    for (const task of tasks) {
      if (!task.startDateTime) continue
      const key = task.startDateTime.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(task)
    }
    // Декілька задач на точно один час (§4.4) — об'єднати в один розгортний рядок усередині дня
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([dateKey, dayTasks]) => {
        const byTime = new Map()
        for (const task of dayTasks) {
          if (!byTime.has(task.startDateTime)) byTime.set(task.startDateTime, [])
          byTime.get(task.startDateTime).push(task)
        }
        return [dateKey, Array.from(byTime.values())]
      })
  }, [tasks])

  const renderTaskRow = (task) => {
    const itemKey = `${task.id}-${task.startDateTime}`

    if (movingTaskId === itemKey) {
      return (
        <MoveTaskForm
          key={itemKey}
          initialDate={fromApiDateTime(task.startDateTime)}
          onConfirm={(dt) => handleMove(task, dt)}
          onCancel={() => setMovingTaskId(null)}
        />
      )
    }

    if (editingTaskId === itemKey) {
      return (
        <EditTaskForm
          key={itemKey}
          task={task}
          onSave={(payload) => handleSaveEdit(task, payload)}
          onCancel={() => setEditingTaskId(null)}
        />
      )
    }

    const actions = task.isVirtual
      ? [
          { label: t('planner.actionMove'), onClick: () => setMovingTaskId(itemKey) },
          { label: t('planner.actionDelete'), onClick: () => handleCancelOccurrence(task), variant: 'danger' },
        ]
      : [
          { label: t('planner.actionDone'), onClick: () => handleResolve(task.id, 'Done') },
          { label: t('planner.actionSkipped'), onClick: () => handleResolve(task.id, 'Skipped') },
          { label: t('planner.actionEdit'), onClick: () => setEditingTaskId(itemKey) },
          { label: t('planner.actionMove'), onClick: () => setMovingTaskId(itemKey) },
          { label: t('planner.actionDelete'), onClick: () => handleDelete(task.id), variant: 'danger' },
        ]

    return <TaskItem key={itemKey} task={task} actions={actions} />
  }

  const locale = language === 'uk' ? 'uk-UA' : 'en-US'

  const handleFromChange = (e) => {
    const from = parseDate(e.target.value)
    onRangeChange({ from, to: clampToAfterFrom(from, range.to) })
  }

  const handleToChange = (e) => {
    const to = parseDate(e.target.value)
    onRangeChange({ from: clampFromBeforeTo(range.from, to), to })
  }

  return (
    <div className="period-view">
      <div className="period-view-controls">
        <label>
          {t('planner.periodFrom')}
          <input
            type="date"
            value={toApiDate(range.from)}
            min={toApiDate(addMonths(range.to, -1))}
            max={toApiDate(range.to)}
            onChange={handleFromChange}
          />
        </label>
        <label>
          {t('planner.periodTo')}
          <input
            type="date"
            value={toApiDate(range.to)}
            min={toApiDate(range.from)}
            max={toApiDate(addMonths(range.from, 1))}
            onChange={handleToChange}
          />
        </label>
        <span className="period-view-hint">{t('planner.periodMaxHint')}</span>
      </div>

      {groups.length === 0 ? (
        <p className="placeholder-text">{t('planner.noTasksPeriod')}</p>
      ) : (
        <div className="period-view-list">
          {groups.map(([dateKey, timeGroups]) => (
            <div key={dateKey} className="period-view-group">
              <div className="period-view-group-date">
                {fromApiDateTime(dateKey).toLocaleDateString(locale, { day: 'numeric', month: 'long', weekday: 'short' })}
              </div>
              {timeGroups.map((group) =>
                group.length === 1 ? (
                  renderTaskRow(group[0])
                ) : (
                  <OverlapGroup key={group[0].startDateTime} tasks={group} renderItem={renderTaskRow} />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
