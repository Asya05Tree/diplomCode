import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { setStudySettings, getScheduleEntries, addScheduleEntry, removeScheduleEntry } from '../../api/study'
import { encodeWeekDaysPattern } from '../../utils/recurrence'
import { summarizeEntry } from './studyShared'

const PARITIES = ['weekly', 'num', 'denom'] // щотижня / чисельник / знаменник

// Розклад. Угорі — період навчання/канікул і дати семестру/року (пишуть у StudySettings).
// Нижче — генератор: предмет + (студент) лекція/семінар + номер пари + дні + парність → створюється
// правило повторення на весь семестр (час береться з обраної пари), яке видно і в спільному календарі.
export default function ScheduleTab({ subjects, bells, settings, reloadSettings, isPupil }) {
  const { t, weekdays, orderedWeekDays, weekdaysIso } = useI18n()
  // ISO-мітки (Пн..Нд) — для summarizeEntry, яке шукає назву за номером дня (label[d-1]).
  const weekdayLabels = weekdaysIso

  const [cfg, setCfg] = useState(settings)
  const [savedNote, setSavedNote] = useState('')
  const [entries, setEntries] = useState([])

  const emptyLesson = { subjectId: '', sessionKind: 'lecture', pairNumber: bells.length ? 1 : '', parity: 'weekly', days: new Set() }
  const [lesson, setLesson] = useState(emptyLesson)

  useEffect(() => { setCfg(settings) }, [settings])
  const reloadEntries = async () => setEntries(await getScheduleEntries('lesson'))
  useEffect(() => { reloadEntries() }, [])

  const setC = (patch) => setCfg((c) => ({ ...c, ...patch }))

  const saveSettings = async () => {
    await setStudySettings(cfg)
    await reloadSettings()
    setSavedNote(t('study.saved'))
    setTimeout(() => setSavedNote(''), 1800)
  }

  const toggleDay = (d) =>
    setLesson((l) => {
      const days = new Set(l.days)
      if (days.has(d)) days.delete(d)
      else days.add(d)
      return { ...l, days }
    })

  const canAdd = lesson.subjectId && lesson.pairNumber && lesson.days.size > 0 && cfg?.studyStart && cfg?.studyEnd

  const addLesson = async (e) => {
    e.preventDefault()
    if (!canAdd) return
    const bell = bells[Number(lesson.pairNumber) - 1]
    const time = bell ? bell.startTime : '08:30'

    // Будуємо тижневий шаблон: щотижня (1 тиждень) або чисельник/знаменник (2 тижні)
    const cycleWeeks = lesson.parity === 'weekly' ? 1 : 2
    const weekPattern = Array.from({ length: cycleWeeks }, () => new Set())
    const targetWeek = lesson.parity === 'denom' ? 1 : 0
    weekPattern[targetWeek] = new Set(lesson.days)

    const recurrence = {
      type: 'WeekCycle',
      timeOfDay: `${time}:00`,
      startDate: cfg.studyStart,
      endDate: cfg.studyEnd,
      cycleWeeks,
      cycleAnchorDate: cycleWeeks > 1 ? cfg.studyStart : null,
      weekDaysPattern: encodeWeekDaysPattern(weekPattern),
      weekDayTimesPattern: null,
      intervalDays: null,
      monthDayMode: null,
      monthDays: null,
      monthDayTimesPattern: null,
    }

    await addScheduleEntry({
      entryKind: 'lesson',
      subjectId: Number(lesson.subjectId),
      name: null,
      sessionKind: isPupil ? null : lesson.sessionKind,
      pairNumber: Number(lesson.pairNumber),
      form: null,
      room: null,
      link: null,
      recurrence,
    })
    setLesson(emptyLesson)
    await reloadEntries()
  }

  const remove = async (id) => {
    await removeScheduleEntry(id)
    await reloadEntries()
  }

  const subjectName = (id) => subjects.find((s) => s.id === id)?.name ?? '—'

  return (
    <div className="card">
      {/* Період навчання, канікул, семестр/триместр */}
      <div className="study-periods">
        <div className="grade-head">
          <h4>{t('study.periodsTitle')}</h4>
          <div className="grade-switch">
            {savedNote && <span className="study-saved-note">{savedNote}</span>}
            <button type="button" className="btn-accent" onClick={saveSettings}>{t('common.save')}</button>
          </div>
        </div>

        <div className="study-seg study-seg--inline">
          {['semester', 'trimester'].map((tt) => (
            <button
              key={tt}
              type="button"
              className={cfg?.termType === tt ? 'study-seg-btn study-seg-btn--active' : 'study-seg-btn'}
              onClick={() => setC({ termType: tt })}
            >
              {t(`study.term.${tt}`)}
            </button>
          ))}
        </div>

        <div className="study-dates-grid">
          <DateField label={t('study.studyStart')} value={cfg?.studyStart} onChange={(v) => setC({ studyStart: v })} />
          <DateField label={t('study.studyEnd')} value={cfg?.studyEnd} onChange={(v) => setC({ studyEnd: v })} />
          <DateField label={t('study.semesterEnd')} value={cfg?.semesterEnd} onChange={(v) => setC({ semesterEnd: v })} />
          <DateField label={t('study.yearEnd')} value={cfg?.yearEnd} onChange={(v) => setC({ yearEnd: v })} />
          <DateField label={t('study.vacationStart')} value={cfg?.vacationStart} onChange={(v) => setC({ vacationStart: v })} />
          <DateField label={t('study.vacationEnd')} value={cfg?.vacationEnd} onChange={(v) => setC({ vacationEnd: v })} />
        </div>
      </div>

      {/* Додавання пари у розклад */}
      <form className="study-lesson-form" onSubmit={addLesson}>
        <h4>{t('study.addLessonTitle')}</h4>
        {subjects.length === 0 ? (
          <p className="placeholder-text">{t('study.needSubjectFirst')}</p>
        ) : (
          <>
            <div className="study-form">
              <select value={lesson.subjectId} onChange={(e) => setLesson((l) => ({ ...l, subjectId: e.target.value }))}>
                <option value="">{t('study.pickSubject')}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {!isPupil && (
                <select value={lesson.sessionKind} onChange={(e) => setLesson((l) => ({ ...l, sessionKind: e.target.value }))}>
                  <option value="lecture">{t('study.lecture')}</option>
                  <option value="seminar">{t('study.seminar')}</option>
                </select>
              )}

              <select value={lesson.pairNumber} onChange={(e) => setLesson((l) => ({ ...l, pairNumber: e.target.value }))}>
                {bells.length === 0 && <option value="">{t('study.noBells')}</option>}
                {bells.map((b, i) => (
                  <option key={i} value={i + 1}>{t('study.pairN', { n: i + 1 })} ({b.startTime}–{b.endTime})</option>
                ))}
              </select>

              <select value={lesson.parity} onChange={(e) => setLesson((l) => ({ ...l, parity: e.target.value }))}>
                {PARITIES.map((p) => (
                  <option key={p} value={p}>{t(`study.parity.${p}`)}</option>
                ))}
              </select>
            </div>

            <div className="study-weekdays">
              {orderedWeekDays.map((d, idx) => (
                <button
                  key={d}
                  type="button"
                  className={lesson.days.has(d) ? 'task-form-weekday task-form-weekday--active' : 'task-form-weekday'}
                  onClick={() => toggleDay(d)}
                >
                  {weekdays[idx]}
                </button>
              ))}
            </div>

            <div className="study-form-actions">
              <button type="submit" className="btn-accent" disabled={!canAdd}>{t('study.addLesson')}</button>
            </div>
          </>
        )}
      </form>

      {entries.length === 0 ? (
        <p className="placeholder-text">{t('study.scheduleEmpty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('study.col.subject')}</th>
                {!isPupil && <th>{t('study.col.session')}</th>}
                <th>{t('study.col.pair')}</th>
                <th>{t('study.scheduleWhen')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((en) => (
                <tr key={en.id}>
                  <td>{en.subjectName || subjectName(en.subjectId)}</td>
                  {!isPupil && <td>{en.sessionKind ? t(`study.${en.sessionKind}`) : <span className="none-text">—</span>}</td>}
                  <td>{en.pairNumber ?? <span className="none-text">—</span>}</td>
                  <td>{summarizeEntry(en, t, weekdayLabels)}</td>
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

function DateField({ label, value, onChange }) {
  return (
    <label className="study-date-field">
      <span>{label}</span>
      <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    </label>
  )
}
