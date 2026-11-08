import { useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import './TimeStatus.css'

// "Важливі борги" — прострочені дедлайни навчання та роботи (не відмічені виконаними). Лише перегляд:
// відмітити виконаним можна у відповідному розділі (Навчання → Борги або Робота → Планування процесу).
export default function DebtsView({ items }) {
  const { t, formatDate } = useI18n()
  // Фільтр-перемикач як у Періоді: 'time' — за датою дедлайну; 'status' — секції «навчання / робота».
  const [sortMode, setSortMode] = useState('time')

  if (!items || items.length === 0) {
    return <p className="placeholder-text">{t('planner.debtsEmpty')}</p>
  }

  const row = (d) => (
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
  )

  const byTime = [...items].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
  const studyDebts = byTime.filter((d) => d.kind === 'study')
  const workDebts = byTime.filter((d) => d.kind === 'work')

  return (
    <div className="planner-debts">
      <p className="planner-debts-hint"><Icon name="warning" /> {t('planner.debtsHint')}</p>

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
        <div className="planner-debts-list">{byTime.map(row)}</div>
      ) : (
        <div className="ts-sections">
          {studyDebts.length > 0 && (
            <div className="ts-group">
              <div className="ts-group-title">{t('nav.study')}</div>
              <div className="planner-debts-list">{studyDebts.map(row)}</div>
            </div>
          )}
          {workDebts.length > 0 && (
            <div className="ts-group">
              <div className="ts-group-title">{t('nav.work')}</div>
              <div className="planner-debts-list">{workDebts.map(row)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
