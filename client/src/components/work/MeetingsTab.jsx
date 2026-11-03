import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getMeetings, addMeeting, removeMeeting } from '../../api/work'
import { todayApiDate, fromApiDateTime, formatTime } from '../../utils/date'

// Зустрічі: з ким, коли (дата+час), посилання або кабінет. Кожна створює подію в спільному
// календарі (moduleCode="work"), тож видалення зустрічі прибирає й подію.
export default function MeetingsTab() {
  const { t, formatDate } = useI18n()
  const [meetings, setMeetings] = useState([])
  const [withWhom, setWithWhom] = useState('')
  const [date, setDate] = useState(todayApiDate())
  const [time, setTime] = useState('10:00')
  const [place, setPlace] = useState('')
  const [error, setError] = useState('')

  const reload = () => getMeetings().then(setMeetings).catch(() => setMeetings([]))
  useEffect(() => { reload() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!withWhom.trim()) { setError(t('work.errMeetingWith')); return }
    setError('')
    await addMeeting({ withWhom: withWhom.trim(), when: `${date}T${time}:00`, place: place.trim() || null })
    setWithWhom('')
    setPlace('')
    await reload()
  }

  const del = async (id) => { await removeMeeting(id); await reload() }

  return (
    <div className="card">
      <div className="work-section-head"><h3>{t('work.meetingsTitle')}</h3></div>

      <form className="work-form work-inline-form" onSubmit={submit}>
        <label className="work-form-grow">{t('work.meetingWith')}<input value={withWhom} onChange={(e) => setWithWhom(e.target.value)} placeholder={t('work.meetingWithPlaceholder')} /></label>
        <label>{t('work.meetingDate')}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>{t('work.meetingTime')}<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="work-form-grow">{t('work.meetingPlace')} <span className="work-optional">({t('work.optional')})</span><input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t('work.meetingPlacePlaceholder')} /></label>
        <button type="submit" className="btn-accent">{t('work.addMeeting')}</button>
      </form>
      {error && <p className="task-form-error">{error}</p>}

      {meetings.length === 0 ? (
        <p className="placeholder-text">{t('work.noMeetings')}</p>
      ) : (
        <div className="work-meet-list">
          {meetings.map((m) => {
            const when = fromApiDateTime(m.when)
            return (
              <div key={m.id} className="work-meet-row">
                <span className="work-meet-time">{formatDate(m.when)}<b>{formatTime(when)}</b></span>
                <div className="work-meet-main">
                  <div className="work-meet-title">{m.withWhom}</div>
                  {m.place && <div className="work-meet-place"><Icon name="arrow-right" />{m.place}</div>}
                </div>
                <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => del(m.id)} aria-label={t('common.delete')}><Icon name="trash" /></button>
              </div>
            )
          })}
        </div>
      )}
      <p className="placeholder-text work-sync-note"><Icon name="calendar" />{t('work.meetingsSyncNote')}</p>
    </div>
  )
}
