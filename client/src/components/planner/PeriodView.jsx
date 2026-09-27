import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import TaskItem from './TaskItem'
import MoveTaskForm from './MoveTaskForm'
import { getPeriodTasks, resolveTask, deleteTask, updateTask } from '../../api/tasks'
import { fromApiDateTime, toApiDate } from '../../utils/date'
import './PeriodView.css'

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// planner-spec.md §4.3 "Період" — довільний діапазон дат. Заливка "де є задачі" тепер —
// базове відображення календаря (Planner.jsx), тут лишається тільки сам перелік завдань.
export default function PeriodView({ token, range, onRangeChange, onTasksChanged }) {
  const { t, language } = useI18n()
  const [tasks, setTasks] = useState([])
  const [movingTaskId, setMovingTaskId] = useState(null)

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

  const handleMove = async (task, startDateTime) => {
    await updateTask(token, task.id, {
      title: task.title,
      description: task.description,
      startDateTime,
      durationMinutes: task.durationMinutes,
      deadline: task.deadline,
    })
    setMovingTaskId(null)
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
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1))
  }, [tasks])

  const locale = language === 'uk' ? 'uk-UA' : 'en-US'

  return (
    <div className="period-view">
      <div className="period-view-controls">
        <label>
          {t('planner.periodFrom')}
          <input
            type="date"
            value={toApiDate(range.from)}
            onChange={(e) => onRangeChange({ ...range, from: parseDate(e.target.value) })}
          />
        </label>
        <label>
          {t('planner.periodTo')}
          <input
            type="date"
            value={toApiDate(range.to)}
            onChange={(e) => onRangeChange({ ...range, to: parseDate(e.target.value) })}
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="placeholder-text">{t('planner.noTasksPeriod')}</p>
      ) : (
        <div className="period-view-list">
          {groups.map(([dateKey, dayTasks]) => (
            <div key={dateKey} className="period-view-group">
              <div className="period-view-group-date">
                {fromApiDateTime(dateKey).toLocaleDateString(locale, { day: 'numeric', month: 'long', weekday: 'short' })}
              </div>
              {dayTasks.map((task) => {
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
                const actions = task.isVirtual
                  ? []
                  : [
                      { label: t('planner.actionDone'), onClick: () => handleResolve(task.id, 'Done') },
                      { label: t('planner.actionSkipped'), onClick: () => handleResolve(task.id, 'Skipped') },
                      { label: t('planner.actionMove'), onClick: () => setMovingTaskId(itemKey) },
                      { label: t('planner.actionDelete'), onClick: () => handleDelete(task.id), variant: 'danger' },
                    ]
                return <TaskItem key={itemKey} task={task} actions={actions} />
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
