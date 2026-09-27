import { useI18n } from '../../i18n'
import { formatTime, fromApiDateTime } from '../../utils/date'
import './TaskItem.css'

// Рядок задачі — спільний для Дня/Періоду/Нерозподілених. Набір кнопок задає той, хто рендерить
// (§4.4/§4.5: у віртуальних інстансів правил — лише "перенести/скасувати цей день", в одноразових —
// готово/пропущено/перенести/видалити).
export default function TaskItem({ task, actions = [] }) {
  const { t } = useI18n()
  const time = task.startDateTime ? formatTime(fromApiDateTime(task.startDateTime)) : '—'

  return (
    <div className="task-item">
      <span className="task-item-time">{time}</span>
      <div className="task-item-body">
        <span className="task-item-title">
          {task.isVirtual && (
            <span className="task-item-recurring-icon" title={t('planner.modeRecurring')}>↻</span>
          )}
          {task.title}
        </span>
        {task.overlaps && <span className="task-item-overlap">⚠ {t('planner.overlapBadge')}</span>}
      </div>
      {actions.length > 0 && (
        <div className="task-item-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={action.variant === 'danger' ? 'task-item-action task-item-action--danger' : 'task-item-action'}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
