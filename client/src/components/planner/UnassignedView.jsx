import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import TaskItem from './TaskItem'
import MoveTaskForm from './MoveTaskForm'
import { getUnassigned, deleteTask, updateTask } from '../../api/tasks'
import { fromApiDateTime, startOfDay } from '../../utils/date'
import './UnassignedView.css'

// planner-spec.md §4.5 — один список для трьох випадків (не влізло / не зроблено вчасно /
// відкладено вручну), без автовидалення, з підсвіткою близького дедлайну. Раніше була окрема
// сторінка /app/unassigned в сайдбарі, тепер — третя вкладка робочої області планувальника.
export default function UnassignedView({ token, onTasksChanged }) {
  const { t } = useI18n()
  const [tasks, setTasks] = useState([])
  const [movingTaskId, setMovingTaskId] = useState(null)

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

  const isDeadlineNear = (task) => {
    if (!task.deadline) return false
    return startOfDay(fromApiDateTime(task.deadline)) <= startOfDay(new Date())
  }

  if (tasks.length === 0) {
    return <p className="placeholder-text">{t('unassigned.empty')}</p>
  }

  return (
    <div className="unassigned-list">
      {tasks.map((task) => {
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
      })}
    </div>
  )
}
