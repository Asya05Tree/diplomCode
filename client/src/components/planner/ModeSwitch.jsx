import { useI18n } from '../../i18n'
import './ModeSwitch.css'

// planner-spec.md §4.2: "День/Період" — один перемикач; "Повторювані" — незалежний тумблер,
// який при активації блокує перший (правило повторення не належить ані дню, ані діапазону).
export default function ModeSwitch({ mode, onModeChange, isRecurring, onRecurringChange }) {
  const { t } = useI18n()

  return (
    <div className="mode-switch">
      <div className="mode-switch-segment">
        <button
          type="button"
          className={mode === 'day' ? 'mode-switch-btn mode-switch-btn--active' : 'mode-switch-btn'}
          disabled={isRecurring}
          onClick={() => onModeChange('day')}
        >
          {t('planner.modeDay')}
        </button>
        <button
          type="button"
          className={mode === 'period' ? 'mode-switch-btn mode-switch-btn--active' : 'mode-switch-btn'}
          disabled={isRecurring}
          onClick={() => onModeChange('period')}
        >
          {t('planner.modePeriod')}
        </button>
      </div>

      <label className="mode-switch-toggle">
        <input type="checkbox" checked={isRecurring} onChange={(e) => onRecurringChange(e.target.checked)} />
        {t('planner.modeRecurring')}
      </label>
    </div>
  )
}
