import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import TaskItem from './TaskItem'
import TaskForm from './TaskForm'
import MoveTaskForm from './MoveTaskForm'
import ReminderBanner from './ReminderBanner'
import { getDayTasks, getReminder, resolveTask, deleteTask, updateTask } from '../../api/tasks'
import { isSameDate, fromApiDateTime } from '../../utils/date'
import './DayView.css'

// planner-spec.md §4.3 "День" — розклад обраної дати. Ранковий банер (§4.5) показується тільки
// коли обрано "сьогодні" — саме тоді нагадувати про вчора має сенс.
export default function DayView({ token, date }) {
  const { t } = useI18n()
  const [tasks, setTasks] = useState([])
  const [reminderTasks, setReminderTasks] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [movingTaskId, setMovingTaskId] = useState(null)

  const isToday = isSameDate(date, new Date())

  const reload = useCallback(() => {
    getDayTasks(token, date).then(setTasks).catch(() => setTasks([]))
  }, [token, date])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!isToday) {
      setReminderTasks([])
      return
    }
    getReminder(token).then(setReminderTasks).catch(() => setReminderTasks([]))
  }, [token, isToday])

  const handleReminderResolve = async (id, action) => {
    await resolveTask(token, id, action)
    setReminderTasks((prev) => prev.filter((task) => task.id !== id))
    reload()
  }

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

  return (
    <div className="day-view">
      {isToday && reminderTasks.length > 0 && (
        <ReminderBanner tasks={reminderTasks} onResolve={handleReminderResolve} />
      )}

      <div className="day-view-header">
        <button type="button" className="day-view-add" onClick={() => setShowForm((s) => !s)}>
          {t('planner.addTask')}
        </button>
      </div>

      {showForm && (
        <TaskForm
          token={token}
          initialDate={date}
          onSaved={() => {
            setShowForm(false)
            reload()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {tasks.length === 0 ? (
        <p className="placeholder-text">{t('planner.noTasksDay')}</p>
      ) : (
        <div className="day-view-list">
          {tasks.map((task) => {
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
      )}
    </div>
  )
}
