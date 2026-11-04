import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import RecurrenceFields from '../planner/RecurrenceFields'
import { createDefaultRecurrenceValue, recurrenceValueToPayload, validateRecurrenceValue } from '../../utils/recurrence'
import { getScheduleEntries, addScheduleEntry, removeScheduleEntry } from '../../api/study'
import { entryKindsFor, LEARNING_FORMS, roomLinkVisibility, summarizeEntry } from './studyShared'

// Консультації / факультативи. Кожен має власну форму навчання (кабінет/посилання) і періодичність,
// як у календарі (повний RecurrenceFields). Створює правило повторення → з'являється у спільному календарі.
// Факультативи доступні лише школярам; у студентів — тільки консультації (isPupil).
export default function ExtraTab({ subjects, learningForm, isPupil }) {
  const { t, formatClock } = useI18n()
  const weekdayLabels = t('planner.weekdaysShort').split(',')
  const kinds = entryKindsFor(isPupil)

  const [entries, setEntries] = useState([])
  const [kind, setKind] = useState('consultation')
  const [name, setName] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [form, setForm] = useState(learningForm) // власна форма (дефолт — спільна)
  const [room, setRoom] = useState('')
  const [link, setLink] = useState('')
  const [rec, setRec] = useState(() => createDefaultRecurrenceValue(new Date()))
  const [err, setErr] = useState('')

  const reload = async () => {
    const all = await getScheduleEntries()
    setEntries(all.filter((e) => e.entryKind === 'consultation' || e.entryKind === 'elective'))
  }
  useEffect(() => { reload() }, [])

  const { showRoom, showLink } = roomLinkVisibility(form)
  const canAdd = useMemo(() => name.trim() && rec.type !== 'Manual', [name, rec])

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!name.trim()) return
    // Ручний тип не підтримуємо тут — немає лівої сітки для кліків по датах
    if (rec.type === 'Manual') { setErr(t('study.manualNotSupported')); return }
    const vErr = validateRecurrenceValue(rec)
    if (vErr) { setErr(t(`taskForm.${vErr}`)); return }

    await addScheduleEntry({
      entryKind: kind,
      subjectId: subjectId ? Number(subjectId) : null,
      name: name.trim(),
      sessionKind: null,
      pairNumber: null,
      form,
      room: showRoom ? room.trim() || null : null,
      link: showLink ? link.trim() || null : null,
      recurrence: recurrenceValueToPayload(rec),
    })
    setName('')
    setSubjectId('')
    setRoom('')
    setLink('')
    setRec(createDefaultRecurrenceValue(new Date()))
    await reload()
  }

  const remove = async (id) => {
    await removeScheduleEntry(id)
    await reload()
  }

  return (
    <div className="card">
      <form className="study-lesson-form" onSubmit={submit}>
        {kinds.length > 1 && (
          <div className="study-seg study-seg--inline">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className={kind === k ? 'study-seg-btn study-seg-btn--active' : 'study-seg-btn'}
                onClick={() => setKind(k)}
              >
                {t(`study.entryKind.${k}`)}
              </button>
            ))}
          </div>
        )}

        <div className="study-form">
          <input type="text" placeholder={t('study.extraName')} value={name} onChange={(e) => setName(e.target.value)} />
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">{t('study.noSubject')}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Власна форма навчання для цієї консультації/факультативу */}
        <div className="study-seg study-seg--inline">
          {LEARNING_FORMS.map((f) => (
            <button
              key={f}
              type="button"
              className={form === f ? 'study-seg-btn study-seg-btn--active' : 'study-seg-btn'}
              onClick={() => setForm(f)}
            >
              {t(`study.form.${f}`)}
            </button>
          ))}
        </div>
        <div className="study-form">
          {showRoom && <input type="text" placeholder={t('study.room')} value={room} onChange={(e) => setRoom(e.target.value)} />}
          {showLink && <input type="text" placeholder={t('study.link')} value={link} onChange={(e) => setLink(e.target.value)} />}
        </div>

        <RecurrenceFields value={rec} onChange={setRec} />

        {err && <p className="auth-error">{err}</p>}
        <div className="study-form-actions">
          <button type="submit" className="btn-accent" disabled={!canAdd}>{t('study.addExtra')}</button>
        </div>
      </form>

      {entries.length === 0 ? (
        <p className="placeholder-text">{t('study.extraEmpty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('study.col.type')}</th>
                <th>{t('study.col.name')}</th>
                <th>{t('study.scheduleWhen')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((en) => (
                <tr key={en.id}>
                  <td>{t(`study.entryKind.${en.entryKind}`)}</td>
                  <td>{en.name || en.subjectName || '—'}</td>
                  <td>{summarizeEntry(en, t, weekdayLabels, formatClock)}</td>
                  <td className="study-row-actions">
                    <button
                      type="button"
                      className="study-icon-btn study-icon-btn--danger"
                      onClick={() => remove(en.id)}
                      aria-label={t('planner.actionDelete')}
                      data-tooltip={t('planner.actionDelete')}
                    >
                      <Icon name="trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
