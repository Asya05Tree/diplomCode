import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import TaskItem from './TaskItem'
import MoveTaskForm from './MoveTaskForm'
import { getUnassigned, deleteTask, updateTask } from '../../api/tasks'
import { fromApiDateTime, startOfDay } from '../../utils/date'
import './UnassignedView.css'
import './TimeStatus.css'

// planner-spec.md §4.5 — один список для трьох випадків (не влізло / не зроблено вчасно /
// відкладено вручну), без автовидалення, з підсвіткою близького дедлайну. Раніше була окрема
// сторінка /app/unassigned в сайдбарі, тепер — третя вкладка робочої області планувальника.
export default function UnassignedView({ token, onTasksChanged }) {
  const { t } = useI18n()
  const [tasks, setTasks] = useState([])
  const [movingTaskId, setMovingTaskId] = useState(null)
  // Фільтр-перемикач як у Періоді: 'time' — за дедлайном (найближчий зверху, без дедлайну внизу);
  // 'status' — секції «прострочено / з дедлайном / без дедлайну».
  const [sortMode, setSortMode] = useState('time')

  const reload = useCallback(() => {
    getUnassigned(token).then(setTasks).catch(() => setTasks([]))
  }, [token])

  useEffect(() => {
    reload()
  }, [reload])

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

  const todayTime = startOfDay(new Date()).getTime()
  const deadlineTime = (task) => (task.deadline ? startOfDay(fromApiDateTime(task.deadline)).getTime() : Infinity)
  const isDeadlineNear = (task) => Boolean(task.deadline) && deadlineTime(task) <= todayTime

  // За часом: найближчий дедлайн зверху, задачі без дедлайну — в кінці.
  const sortedByTime = useMemo(
    () => [...tasks].sort((a, b) => deadlineTime(a) - deadlineTime(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks],
  )
  // За статусом: прострочені / з дедлайном у майбутньому / без дедлайну.
  const overdue = sortedByTime.filter((x) => x.deadline && deadlineTime(x) < todayTime)
  const upcoming = sortedByTime.filter((x) => x.deadline && deadlineTime(x) >= todayTime)
  const noDeadline = sortedByTime.filter((x) => !x.deadline)

  const renderRow = (task) => {
    if (movingTaskId === task.id) {
      return (
        <MoveTaskForm
          key={task.id}
          initialDate={new Date()}
          onConfirm={(dt) => handleMove(task, dt)}
          onCancel={() => setMovingTaskId(null)}
        />
      )
    }
    return (
      <div key={task.id} className={isDeadlineNear(task) ? 'unassigned-row unassigned-row--urgent' : 'unassigned-row'}>
        <TaskItem
          task={task}
          actions={[
            { label: t('planner.actionMove'), onClick: () => setMovingTaskId(task.id) },
            { label: t('planner.actionDelete'), onClick: () => handleDelete(task.id), variant: 'danger' },
          ]}
        />
        {task.deadline && (
          <span className="unassigned-deadline">
            {t('unassigned.deadlineLabel')}: {task.deadline.slice(0, 10)}
          </span>
        )}
      </div>
    )
  }

  if (tasks.length === 0) {
    return <p className="placeholder-text">{t('unassigned.empty')}</p>
  }

  return (
    <div className="unassigned-view">
      <div className="ts-sort-switch">
        <button
          type="button"
          className={sortMode === 'time' ? 'ts-sort-btn ts-sort-btn--active' : 'ts-sort-btn'}
          onClick={() => setSortMode('time')}
        >
          {t('planner.sortByTime')}
        </button>
        <button
          type="button"
          className={sortMode === 'status' ? 'ts-sort-btn ts-sort-btn--active' : 'ts-sort-btn'}
          onClick={() => setSortMode('status')}
        >
          {t('planner.sortByStatus')}
        </button>
      </div>

      {sortMode === 'time' ? (
        <div className="unassigned-list">{sortedByTime.map(renderRow)}</div>
      ) : (
        <div className="ts-sections">
          {overdue.length > 0 && (
            <div className="ts-group ts-group--now">
              <div className="ts-group-title">{t('unassigned.groupOverdue')}</div>
              <div className="unassigned-list">{overdue.map(renderRow)}</div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="ts-group">
              <div className="ts-group-title">{t('unassigned.groupUpcoming')}</div>
              <div className="unassigned-list">{upcoming.map(renderRow)}</div>
            </div>
          )}
          {noDeadline.length > 0 && (
            <div className="ts-group">
              <div className="ts-group-title">{t('unassigned.groupNone')}</div>
              <div className="unassigned-list">{noDeadline.map(renderRow)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
