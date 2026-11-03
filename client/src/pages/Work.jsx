import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import { getWorkSettings, getNextShift } from '../api/work'
import { shiftRangeOf } from '../components/work/workShared'
import ScheduleTab from '../components/work/ScheduleTab'
import ContactsTab from '../components/work/ContactsTab'
import LeaveTab from '../components/work/LeaveTab'
import MeetingsTab from '../components/work/MeetingsTab'
import ObligationsTab from '../components/work/ObligationsTab'
import './Work.css'

// Розділ "Робота". Зверху — заголовок роботи (назва + посада + роботодавець + тип оплати), далі
// п'ять вкладок: Графік та оплата / Контакти / Відпустки й лікарняні / Зустрічі / Зобов'язання.
// Графік створює правила повторення, зустрічі — задачі (обидва moduleCode="work"), тож робочі дні
// й зустрічі видно і в спільному календарі.
export default function Work() {
  const { t, formatDate } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('schedule')

  const [settings, setSettings] = useState(null)
  const [nextShift, setNextShift] = useState(null)

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
  ]

  const payLabel = settings?.rate
    ? `${t(`work.pay.${settings.payType}`)} · ${settings.rate} ${t(`work.rateUnit.${settings.payType}`)}`
    : t(`work.pay.${settings?.payType ?? 'hourly'}`)

  const roleLine = [settings?.position, settings?.employer].filter(Boolean).join(' · ')

  return (
    <div className="work-page">
      {/* Заголовок роботи зверху (назва + посада) */}
      <div className="card work-top">
        <div className="work-top-avatar"><Icon name="work" /></div>
        <div className="work-top-main">
          <span className="work-name">{settings?.jobName || t('work.noJobName')}</span>
          <span className="work-role">{roleLine || t('work.noRole')}</span>
        </div>
        <div className="work-top-meta">
          {settings?.regime && settings.regime !== 'standard' && (
            <span className="work-chip"><span className="work-chip-label">{t('work.regime')}</span> {t(`work.regime.${settings.regime}`)}</span>
          )}
          {settings?.workplace && settings.workplace !== 'onsite' && (
            <span className="work-chip"><span className="work-chip-label">{t('work.workplace')}</span> {t(`work.workplace.${settings.workplace}`)}</span>
          )}
          <span className="work-chip"><span className="work-chip-label">{t('work.payLabel')}</span> {payLabel}</span>
          {nextShift && (
            <span className="work-chip work-chip--accent">
              <Icon name="calendar" />
              {t('work.nextShift')}: {formatDate(nextShift.date)} · {shiftRangeOf(nextShift)}
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
        <ScheduleTab settings={settings} onSettingsChange={setSettings} onScheduleChange={reloadHeader} />
      )}
      {tab === 'contacts' && <ContactsTab />}
      {tab === 'leave' && <LeaveTab />}
      {tab === 'meetings' && <MeetingsTab />}
      {tab === 'obligations' && <ObligationsTab />}
    </div>
  )
}
