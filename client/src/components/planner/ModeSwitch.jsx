import { useI18n } from '../../i18n'
import './ModeSwitch.css'

// planner-spec.md §4.2: три рівноправні вкладки робочої області, активна лише одна —
// "День/Період" (із внутрішнім перемикачем дня/періоду), "Повторювані", "Нерозподілені".
// Раніше "Нерозподілені" була окремою сторінкою в сайдбарі — тепер це третя вкладка тут.
export default function ModeSwitch({ activeTab, onTabChange, mode, onModeChange, unassignedCount, debtsCount = 0 }) {
  const { t } = useI18n()
  const isPeriod = mode === 'period'
  const isDayPeriodActive = activeTab === 'dayPeriod'

  const selectDay = () => {
    onModeChange('day')
    onTabChange('dayPeriod')
  }

  const selectPeriod = () => {
    onModeChange('period')
    onTabChange('dayPeriod')
  }

  const toggleDayPeriod = () => {
    if (!isDayPeriodActive) {
      onTabChange('dayPeriod')
      return
    }
    onModeChange(isPeriod ? 'day' : 'period')
  }

  const unassignedLabel =
    unassignedCount > 0 ? `${t('nav.unassigned')} (${unassignedCount})` : t('nav.unassigned')
  const debtsLabel = debtsCount > 0 ? `${t('planner.modeDebts')} (${debtsCount})` : t('planner.modeDebts')

  return (
    <div className="mode-switch">
      <div
        className={isDayPeriodActive ? 'tab-group tab-group--active' : 'tab-group'}
        onClick={() => onTabChange('dayPeriod')}
      >
        <span
          className={isDayPeriodActive && !isPeriod ? 'tab-sublabel tab-sublabel--active' : 'tab-sublabel'}
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
          className={isDayPeriodActive && isPeriod ? 'tab-sublabel tab-sublabel--active' : 'tab-sublabel'}
          onClick={selectPeriod}
        >
          {t('planner.modePeriod')}
        </span>
      </div>

      <button
        type="button"
        className={
          (activeTab === 'debts' ? 'tab-pill tab-pill--active' : 'tab-pill') +
          (debtsCount > 0 ? ' tab-pill--debts' : '')
        }
        onClick={() => onTabChange('debts')}
      >
        {debtsLabel}
      </button>

      <button
        type="button"
        className={activeTab === 'recurring' ? 'tab-pill tab-pill--active' : 'tab-pill'}
        onClick={() => onTabChange('recurring')}
      >
        {t('planner.modeRecurring')}
      </button>

      <button
        type="button"
        className={activeTab === 'unassigned' ? 'tab-pill tab-pill--active' : 'tab-pill'}
        onClick={() => onTabChange('unassigned')}
      >
        {unassignedLabel}
      </button>
    </div>
  )
}
