import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import TaskItem from './TaskItem'
import MoveTaskForm from './MoveTaskForm'
import { getPeriodTasks, getFreeDays, resolveTask, deleteTask, updateTask } from '../../api/tasks'
import { addDays, fromApiDateTime, toApiDate } from '../../utils/date'
import './PeriodView.css'

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// planner-spec.md §4.3 "Період" — довільний діапазон + вільні дні (мінімальний проміжок у годинах,
// бо повністю порожніх днів за щоденних занять може не бути взагалі).
export default function PeriodView({ token, range, onRangeChange, onMarkingsChange }) {
  const { t, language } = useI18n()
  const [tasks, setTasks] = useState([])
  const [showFreeDays, setShowFreeDays] = useState(false)
  const [minFreeHours, setMinFreeHours] = useState(2)
  const [freeDates, setFreeDates] = useState(new Set())
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

  useEffect(() => {
    if (!showFreeDays || range.from > range.to) {
      setFreeDates(new Set())
      return
    }
    getFreeDays(token, range.from, range.to, minFreeHours)
      .then((days) => setFreeDates(new Set(days.filter((d) => d.isFreeEnough).map((d) => d.date))))
      .catch(() => setFreeDates(new Set()))
  }, [token, range, showFreeDays, minFreeHours])

  useEffect(() => {
    const map = new Map()
    if (range.from <= range.to) {
      let d = new Date(range.from)
      while (d <= range.to) {
        const key = toApiDate(d)
        if (showFreeDays && freeDates.has(key)) {
          map.set(key, 'free')
        } else {
          const isEdge = key === toApiDate(range.from) || key === toApiDate(range.to)
          map.set(key, isEdge ? 'range-edge' : 'range')
        }
        d = addDays(d, 1)
      }
    }
    onMarkingsChange(map)
  }, [range, showFreeDays, freeDates, onMarkingsChange])

  const handleResolve = async (id, action) => {
    await resolveTask(token, id, action)
    reload()
  }

  const handleDelete = async (id) => {
    await deleteTask(token, id)
    reload()
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
        <label className="period-view-toggle">
          <input type="checkbox" checked={showFreeDays} onChange={(e) => setShowFreeDays(e.target.checked)} />
          {t('planner.showFreeDays')}
        </label>
        {showFreeDays && (
          <label>
            {t('planner.minFreeHours')}
            <input
              type="number"
              min="1"
              max="20"
              value={minFreeHours}
              onChange={(e) => setMinFreeHours(Number(e.target.value) || 1)}
            />
          </label>
        )}
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
