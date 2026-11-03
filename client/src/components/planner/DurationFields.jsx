import { useI18n } from '../../i18n'

// Поле тривалості: години (0–8) + хвилини (0–59). Значення тримає батьківська форма окремими
// числами; у хвилини їх зводить combineDuration (кламп до 8 год) на сабміті.
export default function DurationFields({ hours, minutes, onHours, onMinutes }) {
  const { t } = useI18n()
  return (
    <label>
      {t('taskForm.duration')}
      <span className="task-form-duration">
        <input
          type="number"
          min="0"
          max="8"
          value={hours}
          onChange={(e) => onHours(e.target.value)}
          onBlur={(e) => onHours(String(Math.max(0, Math.min(8, Math.floor(Number(e.target.value) || 0)))))}
        />
        <span className="task-form-duration-unit">{t('taskForm.hoursShort')}</span>
        <input
          type="number"
          min="0"
          max="59"
          value={minutes}
          onChange={(e) => onMinutes(e.target.value)}
          onBlur={(e) => onMinutes(String(Math.max(0, Math.min(59, Math.floor(Number(e.target.value) || 0)))))}
        />
        <span className="task-form-duration-unit">{t('taskForm.minutesShort')}</span>
      </span>
    </label>
  )
}
