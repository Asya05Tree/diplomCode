import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'

// Наочні подання розкладу занять (ті самі записи, що й у спільному календарі — moduleCode "study"):
//   • TwoWeekTable — таблиця на два тижні (чисельник/знаменник), рядки = пари, колонки = дні тижня;
//   • WeekCalendar — тижневий календар із реальними датами й навігацією, парність рахується від
//     початку навчання (studyStart), тож збігається з головним календарем.

// "0:1,3|1:4,5" -> Map(тиждень -> Set(деньISO 1..7))
function parsePattern(entry) {
  const byWeek = new Map()
  for (const part of (entry.weekDaysPattern ?? '').split('|').filter(Boolean)) {
    const [wk, list] = part.split(':')
    byWeek.set(Number(wk), new Set((list ?? '').split(',').filter(Boolean).map(Number)))
  }
  return byWeek
}

// Чи відбувається заняття у день dayIso на тижні з парністю parity (0 — чисельник, 1 — знаменник).
// Щотижневі заняття (cycleWeeks <= 1) відбуваються на обох тижнях.
function occursOn(entry, dayIso, parity) {
  const byWeek = parsePattern(entry)
  const cycle = entry.cycleWeeks ?? 1
  if (cycle <= 1) return (byWeek.get(0) || new Set()).has(dayIso)
  return (byWeek.get(parity) || new Set()).has(dayIso)
}

function subjectNameOf(entry, subjects) {
  return entry.subjectName || subjects.find((s) => s.id === entry.subjectId)?.name || '—'
}

// Клітинка: усі заняття цієї пари, цього дня, цієї парності.
function Cell({ items, subjects, isPupil, t }) {
  if (!items.length) return <td className="study-grid-cell" />
  return (
    <td className="study-grid-cell study-grid-cell--has">
      {items.map((e) => (
        <div key={e.id} className="study-grid-item">
          <span className="study-grid-subj">{subjectNameOf(e, subjects)}</span>
          {!isPupil && e.sessionKind && <em>{t(`study.${e.sessionKind}`)}</em>}
        </div>
      ))}
    </td>
  )
}

export function TwoWeekTable({ entries, bells, subjects, isPupil }) {
  const { t, orderedWeekDays, weekdays, formatClock } = useI18n()
  const hasTwoWeek = entries.some((e) => (e.cycleWeeks ?? 1) > 1)
  const weeks = hasTwoWeek ? [0, 1] : [0]
  const cellItems = (pair, dayIso, parity) =>
    entries.filter((e) => e.pairNumber === pair && occursOn(e, dayIso, parity))

  if (bells.length === 0) return <p className="placeholder-text">{t('study.scheduleNeedBells')}</p>
  if (entries.length === 0) return <p className="placeholder-text">{t('study.scheduleEmpty')}</p>

  return (
    <div className="study-sched-views">
      {weeks.map((parity) => (
        <div key={parity} className="study-week-block">
          {hasTwoWeek && (
            <h4 className="study-week-title">
              {parity === 0 ? t('study.weekNumerator') : t('study.weekDenominator')}
            </h4>
          )}
          <div className="table-scroll">
            <table className="data-table study-grid">
              <thead>
                <tr>
                  <th className="study-grid-pairhead">{t('study.col.pair')}</th>
                  {orderedWeekDays.map((d, idx) => <th key={d}>{weekdays[idx]}</th>)}
                </tr>
              </thead>
              <tbody>
                {bells.map((b, i) => (
                  <tr key={i}>
                    <td className="study-grid-time">
                      <b>{i + 1}</b>
                      <span>{formatClock(b.startTime)}–{formatClock(b.endTime)}</span>
                    </td>
                    {orderedWeekDays.map((d) => (
                      <Cell key={d} items={cellItems(i + 1, d, parity)} subjects={subjects} isPupil={isPupil} t={t} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

export function WeekCalendar({ entries, bells, subjects, isPupil, anchorDate }) {
  const { t, formatClock, formatDate } = useI18n()
  const [offset, setOffset] = useState(0)

  // Понеділок тижня, що показуємо (±offset тижнів від поточного).
  const monday = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const mondayShift = (d.getDay() + 6) % 7 // 0 = понеділок
    d.setDate(d.getDate() - mondayShift + offset * 7)
    return d
  }, [offset])

  // Парність тижня відносно початку навчання (той самий відлік, що й у головному календарі).
  const parity = useMemo(() => {
    if (!anchorDate) return 0
    const a = new Date(`${anchorDate}T00:00:00`)
    a.setDate(a.getDate() - ((a.getDay() + 6) % 7)) // понеділок тижня початку навчання
    const weeks = Math.round((monday - a) / (7 * 86400000))
    return ((weeks % 2) + 2) % 2
  }, [anchorDate, monday])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    }),
    [monday],
  )

  const dayIso = (d) => ((d.getDay() + 6) % 7) + 1 // 1..7 (Пн..Нд)
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const cellItems = (pair, d) => {
    const ds = iso(d)
    return entries.filter((e) =>
      e.pairNumber === pair &&
      occursOn(e, dayIso(d), parity) &&
      (!e.startDate || ds >= e.startDate) &&
      (!e.endDate || ds <= e.endDate))
  }

  if (bells.length === 0) return <p className="placeholder-text">{t('study.scheduleNeedBells')}</p>

  const todayIso = iso(new Date())
  const rangeLabel = `${formatDate(iso(days[0]))} — ${formatDate(iso(days[6]))}`

  return (
    <div className="study-cal">
      <div className="study-cal-nav">
        <button type="button" className="pill" onClick={() => setOffset((o) => o - 1)}>
          <Icon name="chevron-left" /> {t('study.weekPrev')}
        </button>
        <span className="study-cal-range">
          {rangeLabel}
          {entries.some((e) => (e.cycleWeeks ?? 1) > 1) && (
            <em> · {parity === 0 ? t('study.weekNumerator') : t('study.weekDenominator')}</em>
          )}
        </span>
        <button type="button" className="pill" onClick={() => setOffset((o) => o + 1)}>
          {t('study.weekNext')} <Icon name="chevron-right" />
        </button>
        {offset !== 0 && (
          <button type="button" className="pill" onClick={() => setOffset(0)}>{t('study.weekToday')}</button>
        )}
      </div>
      <div className="table-scroll">
        <table className="data-table study-grid">
          <thead>
            <tr>
              <th className="study-grid-pairhead">{t('study.col.pair')}</th>
              {days.map((d) => (
                <th key={iso(d)} className={iso(d) === todayIso ? 'study-grid-today' : undefined}>
                  {formatDate(iso(d))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bells.map((b, i) => (
              <tr key={i}>
                <td className="study-grid-time">
                  <b>{i + 1}</b>
                  <span>{formatClock(b.startTime)}–{formatClock(b.endTime)}</span>
                </td>
                {days.map((d) => (
                  <Cell key={iso(d)} items={cellItems(i + 1, d)} subjects={subjects} isPupil={isPupil} t={t} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
