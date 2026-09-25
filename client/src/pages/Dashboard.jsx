import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { getHealth } from '../api/client'
import './Dashboard.css'

const PERIODS = ['today', 'week', 'month']

// Розташування підтверджено: календар ліворуч, права колонка — задачі вибраного періоду
// (дефолт "сьогодні") зверху і задачі, що потребують рішення (перенести/видалити), знизу.
export default function Dashboard() {
  const { t } = useI18n()
  const [apiStatus, setApiStatus] = useState('checking')
  const [period, setPeriod] = useState('today')

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'))
  }, [])

  return (
    <div className="dashboard">
      <section className="dashboard-calendar card">
        <h2>{t('dashboard.title')}</h2>
        <p className="placeholder-text">Календар / список задач на сьогодні — заглушка</p>
      </section>

      <aside className="dashboard-side">
        <div className="card dashboard-period" style={{ borderLeft: '3px solid var(--color-tasks)' }}>
          <div className="period-header">
            <h3>{t('dashboard.tasksForPeriod')}</h3>
            <div className="period-switch">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={p === period ? 'period-btn period-btn--active' : 'period-btn'}
                  onClick={() => setPeriod(p)}
                >
                  {t(`dashboard.period.${p}`)}
                </button>
              ))}
            </div>
          </div>
          <p className="placeholder-text">{t('dashboard.noTasksForPeriod')}</p>
        </div>

        <div className="card dashboard-decisions" style={{ borderLeft: '3px solid var(--color-tasks)' }}>
          <h3>{t('dashboard.needsDecision')}</h3>
          <p className="placeholder-text">{t('dashboard.needsDecisionHint')}</p>
          {/* Приклад картки задачі, що чекає рішення — реальні дані з'являться в місяці 2 (Task API) */}
          <div className="decision-item">
            <span>Приклад задачі</span>
            <div className="decision-actions">
              <button type="button">{t('dashboard.actionMove')}</button>
              <button type="button">{t('dashboard.actionDelete')}</button>
            </div>
          </div>
        </div>

        <div className={`card api-status api-status--${apiStatus}`}>
          {apiStatus === 'online' && t('dashboard.apiOnline')}
          {apiStatus === 'offline' && t('dashboard.apiOffline')}
          {apiStatus === 'checking' && '...'}
        </div>
      </aside>
    </div>
  )
}
