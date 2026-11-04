import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import { getWorkSettings, setWorkSettings, getNextShift } from '../api/work'
import { shiftRangeOf } from '../components/work/workShared'
import ScheduleTab from '../components/work/ScheduleTab'
import ContactsTab from '../components/work/ContactsTab'
import LeaveTab from '../components/work/LeaveTab'
import MeetingsTab from '../components/work/MeetingsTab'
import ObligationsTab from '../components/work/ObligationsTab'
import ProcessTab from '../components/work/ProcessTab'
import './Work.css'

// Розділ "Робота". Зверху — заголовок роботи (назва + посада + роботодавець + тип оплати), далі
// п'ять вкладок: Графік та оплата / Контакти / Відпустки й лікарняні / Зустрічі / Зобов'язання.
// Графік створює правила повторення, зустрічі — задачі (обидва moduleCode="work"), тож робочі дні
// й зустрічі видно і в спільному календарі.
export default function Work() {
  const { t, formatDate, formatClock } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('schedule')

  const [settings, setSettings] = useState(null)
  const [nextShift, setNextShift] = useState(null)

  // Профіль (назва/посада/роботодавець) редагується прямо в заголовку й зберігається на blur,
  // як зріст/вага у здоров'ї. Поля — локальні рядки, синхронізуються з settings.
  const [jobName, setJobName] = useState('')
  const [position, setPosition] = useState('')
  const [employer, setEmployer] = useState('')

  const reloadHeader = useCallback(() => {
    return Promise.all([getWorkSettings(), getNextShift()]).then(([s, n]) => {
      setSettings(s)
      setNextShift(n)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    reloadHeader()
      .then(() => { if (!cancelled) setLoading(false) })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [reloadHeader])

  useEffect(() => {
    setJobName(settings?.jobName ?? '')
    setPosition(settings?.position ?? '')
    setEmployer(settings?.employer ?? '')
  }, [settings])

  // Зберегти профіль: решту полів settings (тип оплати тощо) лишаємо незмінними.
  const saveWorkProfile = async () => {
    const payload = {
      jobName: jobName.trim(),
      position: position.trim() || null,
      employer: employer.trim() || null,
      payType: settings?.payType ?? 'hourly',
      rate: settings?.rate ?? null,
      regime: settings?.regime ?? 'standard',
      workplace: settings?.workplace ?? 'onsite',
      normHours: settings?.normHours ?? null,
      fullRateRetained: settings?.fullRateRetained ?? false,
      extraVacationDays: settings?.extraVacationDays ?? null,
    }
    setSettings((s) => ({ ...(s || {}), ...payload }))
    await setWorkSettings(payload).catch(() => {})
  }

  if (loading) {
    return <div className="work-page"><p className="placeholder-text">{t('common.loading')}</p></div>
  }
  if (error) {
    return <div className="work-page"><p className="placeholder-text">{t('common.error')}</p></div>
  }

  const tabs = [
    { key: 'schedule', icon: 'calendar-days' },
    { key: 'contacts', icon: 'user' },
    { key: 'leave', icon: 'health' },
    { key: 'meetings', icon: 'bell' },
    { key: 'obligations', icon: 'clipboard' },
    { key: 'process', icon: 'board' },
  ]

  return (
    <div className="work-page">
      {/* Заголовок роботи зверху: назва/посада/роботодавець редагуються прямо тут (зберігаються на blur) */}
      <div className="card work-top">
        <div className="work-top-avatar"><Icon name="work" /></div>
        <div className="work-top-main">
          <input
            className="work-name-input"
            value={jobName}
            maxLength={60}
            placeholder={t('work.jobName')}
            onChange={(e) => setJobName(e.target.value)}
            onBlur={saveWorkProfile}
          />
          <div className="work-role-inputs">
            <input className="work-role-input" value={position} maxLength={40} placeholder={t('work.position')} onChange={(e) => setPosition(e.target.value)} onBlur={saveWorkProfile} />
            <input className="work-role-input" value={employer} maxLength={60} placeholder={t('work.employer')} onChange={(e) => setEmployer(e.target.value)} onBlur={saveWorkProfile} />
          </div>
        </div>
        <div className="work-top-meta">
          {nextShift && (
            <span className="work-chip work-chip--accent">
              <Icon name="calendar" />
              {t('work.nextShift')}: {formatDate(nextShift.date)} · {shiftRangeOf(nextShift, formatClock)}
            </span>
          )}
        </div>
      </div>

      <div className="work-tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'work-tab work-tab--active' : 'work-tab'}
            onClick={() => setTab(item.key)}
          >
            <span className="work-tab-icon"><Icon name={item.icon} /></span>
            <span className="work-tab-title">{t(`work.tab.${item.key}`)}</span>
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <ScheduleTab settings={settings} onScheduleChange={reloadHeader} />
      )}
      {tab === 'contacts' && <ContactsTab />}
      {tab === 'leave' && <LeaveTab />}
      {tab === 'meetings' && <MeetingsTab />}
      {tab === 'obligations' && <ObligationsTab />}
      {tab === 'process' && <ProcessTab />}
    </div>
  )
}
