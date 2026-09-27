import { useI18n } from '../../i18n'
import { formatTime, fromApiDateTime } from '../../utils/date'
import './ReminderBanner.css'

// planner-spec.md §4.5 — банер над днем, коли обрано "сьогодні" й лишились учорашні незакриті
// задачі. Три кнопки на задачу; не відповів — задача сама піде в Unknown при наступному sweep.
export default function ReminderBanner({ tasks, onResolve }) {
  const { t } = useI18n()
  if (tasks.length === 0) return null

  return (
    <div className="reminder-banner">
      <p className="reminder-banner-title">{t('reminder.title', { count: tasks.length })}</p>
      {tasks.map((task) => (
        <div key={task.id} className="reminder-banner-row">
          <span className="reminder-banner-task">
            {formatTime(fromApiDateTime(task.startDateTime))} · {task.title}
          </span>
          <div className="reminder-banner-actions">
            <button type="button" onClick={() => onResolve(task.id, 'Done')}>{t('reminder.done')}</button>
            <button type="button" onClick={() => onResolve(task.id, 'Skipped')}>{t('reminder.skipped')}</button>
            <button type="button" onClick={() => onResolve(task.id, 'Postpone')}>{t('reminder.postpone')}</button>
          </div>
        </div>
      ))}
    </div>
  )
}
