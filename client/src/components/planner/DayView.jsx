import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import TaskItem from './TaskItem'
import TaskForm from './TaskForm'
import EditTaskForm from './EditTaskForm'
import MoveTaskForm from './MoveTaskForm'
import OverlapGroup from './OverlapGroup'
import ReminderBanner from './ReminderBanner'
import { getDayTasks, getReminder, resolveTask, deleteTask, updateTask, addException } from '../../api/tasks'
import { isSameDate, fromApiDateTime, toApiDate, timeStatusOf } from '../../utils/date'
import './DayView.css'
import './TimeStatus.css'

// planner-spec.md §4.3 "День" — розклад обраної дати. Ранковий банер (§4.5) показується тільки
// коли обрано "сьогодні" — саме тоді нагадувати про вчора має сенс.
export default function DayView({ token, date, onTasksChanged }) {
  const { t, language } = useI18n()
  const [tasks, setTasks] = useState([])
  const [reminderTasks, setReminderTasks] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [movingTaskId, setMovingTaskId] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  // Режим сортування списку: 'time' — за датою/часом (як було); 'status' — за статусом часу
  // (зараз / майбутнє / минуле). Підсвічування "зараз" діє в обох режимах.
  const [sortMode, setSortMode] = useState('time')

  const isToday = isSameDate(date, new Date())
  // Поточний момент — знімок на час рендера (без живого тикання)
  const now = new Date()
  // Текстова дата зліва (замість самої лише підсвітки в сітці) — щоб було однозначно
  // видно, який саме день зараз обрано
  const locale = language === 'uk' ? 'uk-UA' : 'en-US'
  const dateLabel = date.toLocaleDateString(locale, { day: 'numeric', month: 'long', weekday: 'long' })

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
    onTasksChanged?.()
  }

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

  // Повторюваний інстанс не має власного рядка в Tasks (ділить Id з шаблоном правила) — перенесення
  // чи видалення для одного дня не чіпає шаблон, а стає винятком правила (§3.3, planner-spec.md)
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

  // Декілька задач на точно один час (§4.4) групуються в один розгортний рядок (OverlapGroup)
  const groupedTasks = useMemo(() => {
    const map = new Map()
    for (const task of tasks) {
      const key = task.startDateTime ?? `none-${task.id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(task)
    }
    return Array.from(map.values())
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

    // Назву/опис повторюваної задачі можна змінити лише для правила цілком (RecurringView),
    // тому тут для віртуальних інстансів лише перенесення/скасування цього дня (§3.3)
    // Події з вкладки «Перегляд і читання»: поки не завершені — можна редагувати/перенести/видалити
    // (без «готово/пропущено» — завершення робиться у вкладці). Завершені — лише видалити
    // (видалення прибирає й запис у вкладці).
    const actions = task.isVirtual
      ? [
          { label: t('planner.actionMove'), onClick: () => setMovingTaskId(itemKey) },
          { label: t('planner.actionDelete'), onClick: () => handleCancelOccurrence(task), variant: 'danger' },
        ]
      : task.sourceModule === 'media'
      ? task.status === 'Done'
        ? [
            { label: t('planner.actionDelete'), onClick: () => handleDelete(task.id), variant: 'danger' },
          ]
        : [
            { label: t('planner.actionEdit'), onClick: () => setEditingTaskId(itemKey) },
            { label: t('planner.actionMove'), onClick: () => setMovingTaskId(itemKey) },
            { label: t('planner.actionDelete'), onClick: () => handleDelete(task.id), variant: 'danger' },
          ]
      : [
          { label: t('planner.actionDone'), onClick: () => handleResolve(task.id, 'Done') },
          { label: t('planner.actionSkipped'), onClick: () => handleResolve(task.id, 'Skipped') },
          { label: t('planner.actionEdit'), onClick: () => setEditingTaskId(itemKey) },
          { label: t('planner.actionMove'), onClick: () => setMovingTaskId(itemKey) },
          { label: t('planner.actionDelete'), onClick: () => handleDelete(task.id), variant: 'danger' },
        ]

    const isNow = timeStatusOf(task.startDateTime, task.durationMinutes, now) === 'now'
    return <TaskItem key={itemKey} task={task} actions={actions} isNow={isNow} />
  }

  // Рендер списку груп (кожна група — задачі на один час; кілька → OverlapGroup)
  const renderGroups = (grps) =>
    grps.map((group) =>
      group.length === 1 ? (
        renderTaskRow(group[0])
      ) : (
        <OverlapGroup key={group[0].startDateTime} tasks={group} renderItem={renderTaskRow} />
      ))

  // Розкладка груп по статусу часу; усередині кожної секції — за зростанням часу
  const statusOf = (group) => timeStatusOf(group[0].startDateTime, group[0].durationMinutes, now)
  const byStart = (a, b) => ((a[0].startDateTime ?? '') < (b[0].startDateTime ?? '') ? -1 : 1)
  const nowGroups = groupedTasks.filter((g) => statusOf(g) === 'now').sort(byStart)
  const futureGroups = groupedTasks.filter((g) => statusOf(g) === 'future').sort(byStart)
  const pastGroups = groupedTasks.filter((g) => statusOf(g) === 'past').sort(byStart)

  return (
    <div className="day-view">
      {isToday && reminderTasks.length > 0 && (
        <ReminderBanner tasks={reminderTasks} onResolve={handleReminderResolve} />
      )}

      <div className="day-view-header">
        <span className="day-view-date">{dateLabel}</span>
        <button type="button" className="day-view-add" onClick={() => setShowForm((s) => !s)}>
          {showForm ? t('auth.back') : t('planner.addTask')}
        </button>
      </div>

      {showForm && (
        <TaskForm
          token={token}
          initialDate={date}
          onSaved={() => {
            setShowForm(false)
            reload()
            onTasksChanged?.()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {tasks.length === 0 ? (
        <p className="placeholder-text">{t('planner.noTasksDay')}</p>
      ) : (
        <>
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
            <div className="day-view-list">{renderGroups(groupedTasks)}</div>
          ) : (
            <div className="ts-sections">
              {nowGroups.length > 0 && (
                <div className="ts-group ts-group--now">
                  <div className="ts-group-title">{t('planner.statusNow')}</div>
                  <div className="day-view-list">{renderGroups(nowGroups)}</div>
                </div>
              )}
              {futureGroups.length > 0 && (
                <div className="ts-group">
                  <div className="ts-group-title">{t('planner.statusFuture')}</div>
                  <div className="day-view-list">{renderGroups(futureGroups)}</div>
                </div>
              )}
              {pastGroups.length > 0 && (
                <div className="ts-group">
                  <div className="ts-group-title">{t('planner.statusPast')}</div>
                  <div className="day-view-list">{renderGroups(pastGroups)}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
