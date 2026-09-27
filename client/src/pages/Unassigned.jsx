import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import TaskItem from '../components/planner/TaskItem'
import MoveTaskForm from '../components/planner/MoveTaskForm'
import { getUnassigned, deleteTask, updateTask } from '../api/tasks'
import { fromApiDateTime, startOfDay } from '../utils/date'
import './Unassigned.css'

const AUTH_TOKEN_KEY = 'authToken'

// planner-spec.md §4.5 — один список для трьох випадків (не влізло / не зроблено вчасно /
// відкладено вручну), без автовидалення, з підсвіткою близького дедлайну.
export default function Unassigned() {
  const { t } = useI18n()
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
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

  const isDeadlineNear = (task) => {
    if (!task.deadline) return false
    return startOfDay(fromApiDateTime(task.deadline)) <= startOfDay(new Date())
  }

  return (
    <div className="unassigned-page">
      <h2>{t('unassigned.title')}</h2>

      {tasks.length === 0 ? (
        <p className="placeholder-text">{t('unassigned.empty')}</p>
      ) : (
        <div className="card unassigned-list">
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
      )}
    </div>
  )
}
