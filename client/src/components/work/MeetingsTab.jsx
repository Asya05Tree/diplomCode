import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import FieldHelp from '../FieldHelp'
import { getMeetings, addMeeting, removeMeeting, getContacts } from '../../api/work'
import { todayApiDate, fromApiDateTime } from '../../utils/date'

// Зустрічі: з ким, коли (дата+час), посилання або кабінет. Кожна створює подію в спільному
// календарі (moduleCode="work"), тож видалення зустрічі прибирає й подію. "З ким" можна обрати
// зі списку робочих контактів (datalist) або ввести вручну. Відображення картками: зверху майбутні
// (від найближчої до найдальшої), знизу — ті, що вже минули; минулі можна прибрати однією кнопкою.
export default function MeetingsTab() {
  const { t, formatDate, formatTime } = useI18n()
  const [meetings, setMeetings] = useState([])
  const [contacts, setContacts] = useState([])
  const [withWhom, setWithWhom] = useState('')
  const [date, setDate] = useState(todayApiDate())
  const [time, setTime] = useState('10:00')
  const [place, setPlace] = useState('')
  const [error, setError] = useState('')

  const reload = () => getMeetings().then(setMeetings).catch(() => setMeetings([]))
  useEffect(() => {
    reload()
    getContacts().then((list) => setContacts(list || [])).catch(() => setContacts([]))
  }, [])

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

  // Розділяємо на майбутні (за часом, найближчі першими) та минулі (найсвіжіші першими).
  const now = new Date()
  const withTime = meetings.map((m) => ({ ...m, at: fromApiDateTime(m.when) }))
  const upcoming = withTime.filter((m) => m.at >= now).sort((a, b) => a.at - b.at)
  const past = withTime.filter((m) => m.at < now).sort((a, b) => b.at - a.at)

  const clearPast = async () => {
    if (!past.length) return
    if (!window.confirm(t('work.clearPastConfirm', { count: past.length }))) return
    await Promise.all(past.map((m) => removeMeeting(m.id)))
    await reload()
  }

  const Card = ({ m, isPast }) => (
    <div className={isPast ? 'work-meet-card work-meet-card--past' : 'work-meet-card'}>
      <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => del(m.id)} aria-label={t('common.delete')}><Icon name="trash" /></button>
      <span className="work-meet-when">{formatDate(m.when)} <b>{formatTime(m.at)}</b></span>
      <span className="work-meet-who">{m.withWhom}</span>
      {m.place && <span className="work-meet-place"><Icon name="arrow-right" />{m.place}</span>}
    </div>
  )

  return (
    <div className="card">
      <div className="work-section-head"><h3>{t('work.meetingsTitle')}</h3></div>

      <form className="work-form work-inline-form" onSubmit={submit}>
        <label className="work-form-grow"><span className="work-label-head">{t('work.meetingWith')}<FieldHelp text={t('work.meetingWithHelp')} label={t('fieldHelp.label')} /></span><input value={withWhom} onChange={(e) => setWithWhom(e.target.value)} placeholder={t('work.meetingWithPlaceholder')} list="work-contacts-list" /></label>
        <datalist id="work-contacts-list">
          {contacts.map((c) => <option key={c.id} value={c.fullName} />)}
        </datalist>
        <label>{t('work.meetingDate')}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>{t('work.meetingTime')}<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="work-form-grow"><span className="work-label-head">{t('work.meetingPlace')} <span className="work-optional">({t('work.optional')})</span></span><input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t('work.meetingPlacePlaceholder')} /></label>
        <button type="submit" className="btn-accent">{t('work.addMeeting')}</button>
      </form>
      {error && <p className="task-form-error">{error}</p>}

      {meetings.length === 0 ? (
        <p className="placeholder-text">{t('work.noMeetings')}</p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <div className="work-group-head"><h4>{t('work.meetingsUpcoming')}</h4><span className="work-group-count">{upcoming.length}</span></div>
              <div className="work-meet-cards">
                {upcoming.map((m) => <Card key={m.id} m={m} />)}
              </div>
            </>
          )}
          {past.length > 0 && (
            <>
              <div className="work-group-head work-group-head--spread">
                <h4>{t('work.meetingsPast')}</h4>
                <span className="work-group-count">{past.length}</span>
                <button type="button" className="work-pill work-meet-clear" onClick={clearPast}>{t('work.clearPastMeetings')}</button>
              </div>
              <div className="work-meet-cards">
                {past.map((m) => <Card key={m.id} m={m} isPast />)}
              </div>
            </>
          )}
        </>
      )}
      <p className="placeholder-text work-sync-note"><Icon name="calendar" />{t('work.meetingsSyncNote')}</p>
    </div>
  )
}
