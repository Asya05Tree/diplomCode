import { useI18n } from '../../i18n'
import './ModeSwitch.css'

// planner-spec.md §4.2: "День/Період" — Android-стиль тумблер (сірий+повзунок ліворуч = День,
// кольоровий+повзунок праворуч = Період). "Повторювані" — окрема капсула поруч, той самий
// візуальний язик (овал, заливка = активний стан), яка при активації блокує тумблер зліва.
export default function ModeSwitch({ mode, onModeChange, isRecurring, onRecurringChange }) {
  const { t } = useI18n()
  const isPeriod = mode === 'period'

  const toggleDayPeriod = () => {
    if (isRecurring) return
    onModeChange(isPeriod ? 'day' : 'period')
  }

  return (
    <div className="mode-switch">
      <div className={isRecurring ? 'day-period-switch day-period-switch--disabled' : 'day-period-switch'}>
        <span
          className={!isPeriod ? 'day-period-label day-period-label--active' : 'day-period-label'}
          onClick={() => !isRecurring && onModeChange('day')}
        >
          {t('planner.modeDay')}
        </span>

        <button
          type="button"
          className={isPeriod ? 'android-switch android-switch--on' : 'android-switch'}
          onClick={toggleDayPeriod}
          disabled={isRecurring}
          aria-label={t('planner.modePeriod')}
        >
          <span className="android-switch-thumb" />
        </button>

        <span
          className={isPeriod ? 'day-period-label day-period-label--active' : 'day-period-label'}
          onClick={() => !isRecurring && onModeChange('period')}
        >
          {t('planner.modePeriod')}
        </span>
      </div>

      <button
        type="button"
        className={isRecurring ? 'recurring-pill recurring-pill--active' : 'recurring-pill'}
        onClick={() => onRecurringChange(!isRecurring)}
      >
        {t('planner.modeRecurring')}
      </button>
    </div>
  )
}
