import { useI18n } from '../../i18n'
import './ModeSwitch.css'

// planner-spec.md §4.2: "День/Період" і "Список повторюваних задач" — дві рівноправні капсули,
// активна лише одна. Клік по будь-якій частині неактивної капсули одразу перемикає на неї —
// не треба спершу вимикати поточну (раніше: android-switch мав HTML disabled, і щоб дістатись
// "Період" з режиму повторень, треба було спершу клікнути капсулу списку, потім перемикач).
export default function ModeSwitch({ mode, onModeChange, isRecurring, onRecurringChange }) {
  const { t } = useI18n()
  const isPeriod = mode === 'period'

  const selectDay = () => {
    onModeChange('day')
    if (isRecurring) onRecurringChange(false)
  }

  const selectPeriod = () => {
    onModeChange('period')
    if (isRecurring) onRecurringChange(false)
  }

  const toggleDayPeriod = () => {
    if (isRecurring) {
      onRecurringChange(false)
      return
    }
    onModeChange(isPeriod ? 'day' : 'period')
  }

  return (
    <div className="mode-switch">
      <div className={isRecurring ? 'day-period-switch day-period-switch--inactive' : 'day-period-switch'}>
        <span
          className={!isPeriod ? 'day-period-label day-period-label--active' : 'day-period-label'}
          onClick={selectDay}
        >
          {t('planner.modeDay')}
        </span>

        <button
          type="button"
          className={isPeriod ? 'android-switch android-switch--on' : 'android-switch'}
          onClick={toggleDayPeriod}
          aria-label={t('planner.modePeriod')}
        >
          <span className="android-switch-thumb" />
        </button>

        <span
          className={isPeriod ? 'day-period-label day-period-label--active' : 'day-period-label'}
          onClick={selectPeriod}
        >
          {t('planner.modePeriod')}
        </span>
      </div>

      <button
        type="button"
        className={
          isRecurring
            ? 'recurring-pill recurring-pill--active'
            : 'recurring-pill recurring-pill--inactive'
        }
        onClick={() => onRecurringChange(!isRecurring)}
      >
        {t('planner.modeRecurring')}
      </button>
    </div>
  )
}
