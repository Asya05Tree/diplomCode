import { useI18n } from '../../i18n'
import Icon from '../Icon'

// "Важливі борги" — прострочені дедлайни навчання та роботи (не відмічені виконаними). Лише перегляд:
// відмітити виконаним можна у відповідному розділі (Навчання → Борги або Робота → Планування процесу).
export default function DebtsView({ items }) {
  const { t, formatDate } = useI18n()

  if (!items || items.length === 0) {
    return <p className="placeholder-text">{t('planner.debtsEmpty')}</p>
  }

  return (
    <div className="planner-debts">
      <p className="planner-debts-hint"><Icon name="warning" /> {t('planner.debtsHint')}</p>
      <div className="planner-debts-list">
        {items.map((d) => (
          <div key={d.id} className="planner-debt-row">
            <span className={`planner-debt-tag planner-debt-tag--${d.kind}`}>
              {t(d.kind === 'study' ? 'nav.study' : 'nav.work')}
            </span>
            <div className="planner-debt-main">
              <span className="planner-debt-title">{d.title}</span>
              {d.subtitle && <span className="planner-debt-sub">{d.subtitle}</span>}
            </div>
            <span className="planner-debt-due">
              <Icon name="calendar" /> {formatDate(d.due)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
