import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { addDays, addMonths, fromApiDate, getMonthGridCells, toApiDate, todayApiDate } from '../utils/date'
import { addCycleRecord, endCycleRecord, getCycle, removeCycleRecord, setCycleSettings } from '../api/cycle'
import Icon from '../components/Icon'
import './Cycle.css'

function fmt(api) {
  const [y, m, d] = api.split('-')
  return `${d}.${m}.${y}`
}

function fmtShort(api) {
  const [, m, d] = api.split('-')
  return `${d}.${m}`
}

const DEFAULT_CYCLE_LENGTH = 28
const DEFAULT_PERIOD_LENGTH = 6
const REGULAR_SPREAD_THRESHOLD_DAYS = 3

function daysBetween(aApi, bApi) {
  return Math.round((fromApiDate(bApi) - fromApiDate(aApi)) / 86400000)
}

function addApiDays(api, n) {
  return toApiDate(addDays(fromApiDate(api), n))
}

// Показники місячних (дашборд-варіант 6): день циклу, середня довжина циклу й менструації,
// останній цикл, регулярність. Рахуються з реальних відміток користувача (прогноз приходить з
// бекенда окремо) — це не медичні висновки, а статистика по його ж даних.
function computeCycleStats(records) {
  const starts = records.map((r) => r.startDate).sort()
  if (starts.length === 0) {
    return { hasData: false, avgCycleLength: DEFAULT_CYCLE_LENGTH }
  }

  const lastStart = starts[starts.length - 1]
  const lastRecord = records.find((r) => r.startDate === lastStart)
  const lastEnd = lastRecord?.endDate ?? null

  const periodLengths = records.filter((r) => r.endDate).map((r) => daysBetween(r.startDate, r.endDate) + 1)
  const avgPeriodLength = periodLengths.length
    ? Math.round(periodLengths.reduce((s, n) => s + n, 0) / periodLengths.length)
    : null

  const cycleLengths = []
  for (let i = 1; i < starts.length; i++) cycleLengths.push(daysBetween(starts[i - 1], starts[i]))
  const avgCycleLength = cycleLengths.length
    ? Math.round(cycleLengths.reduce((s, n) => s + n, 0) / cycleLengths.length)
    : DEFAULT_CYCLE_LENGTH
  const lastCycleLength = cycleLengths.length ? cycleLengths[cycleLengths.length - 1] : null
  const spread = cycleLengths.length ? Math.max(...cycleLengths) - Math.min(...cycleLengths) : null
  const isRegular = spread === null ? null : spread <= REGULAR_SPREAD_THRESHOLD_DAYS

  const cycleDay = Math.max(1, daysBetween(lastStart, todayApiDate()) + 1)

  return { hasData: true, lastStart, lastEnd, avgPeriodLength, avgCycleLength, lastCycleLength, isRegular, cycleDay }
}

// Усі фази циклу (орієнтовні — похідні від середніх, а не діагноз). Порядок:
// менструація → фолікулярна → овуляція → лютеїнова → прогноз наступної.
function computeCyclePhases(records, forecast, stats) {
  if (!stats.hasData || !forecast?.predictedDate) return []

  const periodLen = stats.avgPeriodLength ?? DEFAULT_PERIOD_LENGTH
  const periodStart = stats.lastStart
  const periodEnd = stats.lastEnd ?? addApiDays(periodStart, periodLen - 1)
  const nextStart = forecast.predictedDate
  const ovulation = addApiDays(nextStart, -14) // лютеїнова фаза ~14 днів — орієнтовно
  const today = todayApiDate()

  const phases = [
    { key: 'menstruation', from: periodStart, to: periodEnd },
    { key: 'follicular', from: addApiDays(periodEnd, 1), to: addApiDays(ovulation, -1) },
    { key: 'ovulation', from: ovulation, to: ovulation, approx: true },
    { key: 'luteal', from: addApiDays(ovulation, 1), to: addApiDays(nextStart, -1) },
    { key: 'predicted', from: nextStart, to: addApiDays(nextStart, periodLen - 1), predicted: true },
  ]

  return phases.map((p) => ({ ...p, current: today >= p.from && today <= p.to }))
}

// Позначки для клітинок календаря: множини днів-початків, днів-кінців, днів менструації та
// прогнозованих днів (apiDate-рядки "YYYY-MM-DD").
function buildCalendarMarks(records, forecast, stats) {
  const starts = new Set()
  const ends = new Set()
  const period = new Set()
  const predicted = new Set()
  const today = todayApiDate()

  for (const r of records) {
    starts.add(r.startDate)
    const last = r.endDate ?? (r.startDate <= today ? today : r.startDate)
    if (r.endDate) ends.add(r.endDate)
    let cursor = r.startDate
    for (let guard = 0; cursor <= last && guard < 40; guard++) {
      period.add(cursor)
      cursor = addApiDays(cursor, 1)
    }
  }

  if (stats?.hasData && forecast?.predictedDate) {
    const periodLen = stats.avgPeriodLength ?? DEFAULT_PERIOD_LENGTH
    let cursor = forecast.predictedDate
    for (let i = 0; i < periodLen; i++) {
      predicted.add(cursor)
      cursor = addApiDays(cursor, 1)
    }
  }

  return { starts, ends, period, predicted }
}

const PHASE_META = [
  { key: 'menstruation', dot: 'menstruation' },
  { key: 'follicular', dot: 'follicular' },
  { key: 'ovulation', dot: 'ovulation' },
  { key: 'luteal', dot: 'luteal' },
  { key: 'predicted', dot: 'predicted' },
]

// Розділ "Цикл" (planner-spec.md §3.7) у вигляді дашборда (обраний макет — варіант 6):
// панель приладів (день циклу + показники), двомісячний розворот календаря, фази циклу
// плитками та реєстр історії. Відмітки й налаштування — з бекенда (/api/cycle), прогноз
// рахується на сервері; фази/овуляція — орієнтовні (похідні від середніх, не медичні висновки).
export default function Cycle() {
  const { t } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [records, setRecords] = useState([])
  const [settings, setSettings] = useState({ reduceLoadOnHeavyDays: false })
  const [forecast, setForecast] = useState({ hasData: false, predictedDate: null, rangeDays: 5, isRegular: null })

  const applyData = (data) => {
    // Порядок введення не гарантований (запис заднім числом тощо) — сортуємо за початком.
    const sorted = [...data.records].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
    setRecords(sorted)
    setSettings(data.settings ?? { reduceLoadOnHeavyDays: false })
    setForecast(data.forecast ?? { hasData: false, predictedDate: null, rangeDays: 5, isRegular: null })
  }

  useEffect(() => {
    let cancelled = false
    getCycle()
      .then((data) => {
        if (cancelled) return
        applyData(data)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const reload = async () => {
    applyData(await getCycle())
  }

  const openRecord = records.find((r) => !r.endDate) ?? null
  const stats = useMemo(() => computeCycleStats(records), [records])
  const phases = useMemo(() => computeCyclePhases(records, forecast, stats), [records, forecast, stats])
  const marks = useMemo(() => buildCalendarMarks(records, forecast, stats), [records, forecast, stats])

  const today = todayApiDate()
  const weekdays = t('planner.weekdaysShort').split(',')

  const handleMarkStart = async () => {
    await addCycleRecord(todayApiDate())
    await reload()
  }

  const handleMarkEnd = async () => {
    if (!openRecord) return
    await endCycleRecord(openRecord.id, todayApiDate())
    await reload()
  }

  const handleDelete = async (id) => {
    await removeCycleRecord(id)
    await reload()
  }

  const handleToggleReduceLoad = async (e) => {
    const value = e.target.checked
    setSettings({ reduceLoadOnHeavyDays: value })
    await setCycleSettings(value)
  }

  // Текст прогнозу в героєві: діапазон ± rangeDays і скільки днів лишилось.
  let forecastText = t('cycle.forecastNoData')
  if (forecast.hasData && forecast.predictedDate) {
    const fromR = toApiDate(addDays(fromApiDate(forecast.predictedDate), -forecast.rangeDays))
    const toR = toApiDate(addDays(fromApiDate(forecast.predictedDate), forecast.rangeDays))
    const daysUntil = Math.round((fromApiDate(forecast.predictedDate) - fromApiDate(today)) / 86400000)
    forecastText = `${t('cycle.nextStart')}: ${fmtShort(fromR)} – ${fmt(toR)}`
    if (daysUntil > 0) forecastText += ` · ${t('cycle.inDays', { n: daysUntil })}`
  }

  const progressPct = stats.hasData
    ? Math.min(100, Math.round((stats.cycleDay / stats.avgCycleLength) * 100))
    : 0

  const regularityText =
    stats.isRegular === null ? '—' : stats.isRegular ? t('cycle.regular') : t('cycle.irregular')

  // Рядки реєстру історії: довжина циклу = відстань до наступного початку.
  const sortedAsc = [...records].sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
  const historyRows = sortedAsc
    .map((r, i) => {
      const next = sortedAsc[i + 1]
      const periodLen = r.endDate
        ? Math.round((fromApiDate(r.endDate) - fromApiDate(r.startDate)) / 86400000) + 1
        : null
      const cycleLen = next
        ? Math.round((fromApiDate(next.startDate) - fromApiDate(r.startDate)) / 86400000)
        : null
      return { ...r, periodLen, cycleLen }
    })
    .reverse()

  const renderMonth = (base) => {
    const year = base.getFullYear()
    const month = base.getMonth()
    const cells = getMonthGridCells(year, month)
    const label = base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    return (
      <div className="cyc-month">
        <div className="cyc-month-label">{label}</div>
        <div className="cyc-grid">
          {weekdays.map((d) => (
            <div key={d} className="cyc-weekday">{d}</div>
          ))}
          {cells.map((cell, idx) => {
            const api = toApiDate(cell.date)
            let state = ''
            let tag = ''
            if (marks.starts.has(api)) {
              state = 'is-start'
              tag = t('cycle.tagStart')
            } else if (marks.ends.has(api)) {
              state = 'is-end'
              tag = t('cycle.tagEnd')
            } else if (marks.period.has(api)) {
              state = 'is-period'
            } else if (marks.predicted.has(api)) {
              state = 'is-predicted'
            }
            const cls = [
              'cyc-day',
              cell.inCurrentMonth ? '' : 'is-muted',
              state,
              api === today ? 'is-today' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <div key={idx} className={cls}>
                {tag && <span className="cyc-tag">{tag}</span>}
                {cell.date.getDate()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="cycle-page">
        <p className="placeholder-text">{t('common.loading')}</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="cycle-page">
        <p className="placeholder-text">{t('common.error')}</p>
      </div>
    )
  }

  return (
    <div className="cycle-page">
      <div className="page-head">
        <h2>{t('nav.cycle')}</h2>
      </div>

      {/* Панель приладів: герой (день циклу + відмітки + PDF) та показники */}
      <div className="card cyc-dash">
        <div className="cyc-hero">
          <div className="cyc-hero-main">
            <span className="cyc-hero-label">{t('cycle.cycleDayLabel')}</span>
            <div className="cyc-hero-num">
              <span className="cyc-hero-day">{stats.hasData ? stats.cycleDay : '—'}</span>
              {stats.hasData && <span className="cyc-hero-of">{t('cycle.of', { n: stats.avgCycleLength })}</span>}
            </div>
          </div>
          <div className="cyc-hero-info">
            <span className="cyc-hero-sub">{forecastText}</span>
            {stats.hasData && (
              <div className="cyc-progress"><div className="cyc-progress-fill" style={{ width: `${progressPct}%` }} /></div>
            )}
            {forecast.insufficientHistory && (
              <span className="placeholder-text">{t('cycle.forecastInsufficient')}</span>
            )}
            {forecast.isRegular === false && (
              <span className="placeholder-text">{t('cycle.forecastIrregular')}</span>
            )}
            <div className="cyc-hero-actions no-print">
              <button type="button" className="btn-period" onClick={handleMarkStart}>
                {t('cycle.markStart')}
              </button>
              <button type="button" className="btn-period btn-period--end" disabled={!openRecord} onClick={handleMarkEnd}>
                {t('cycle.markEnd')}
              </button>
              <button type="button" className="btn-pdf" onClick={() => window.print()}>
                <Icon name="download" /> {t('cycle.exportPdf')}
              </button>
            </div>
          </div>
        </div>

        <div className="cyc-metrics">
          <div className="cyc-metric">
            <span className="cyc-metric-label">{t('cycle.cycleDayLabel')}</span>
            <span className="cyc-metric-value cyc-metric-value--pink">
              {stats.hasData ? `${stats.cycleDay} / ${stats.avgCycleLength}` : '—'}
            </span>
          </div>
          <div className="cyc-metric">
            <span className="cyc-metric-label">{t('cycle.metricAvgCycle')}</span>
            <span className="cyc-metric-value">{t('cycle.daysN', { n: stats.avgCycleLength })}</span>
          </div>
          <div className="cyc-metric">
            <span className="cyc-metric-label">{t('cycle.metricAvgPeriod')}</span>
            <span className="cyc-metric-value">
              {stats.avgPeriodLength ? t('cycle.daysN', { n: stats.avgPeriodLength }) : '—'}
            </span>
          </div>
          <div className="cyc-metric">
            <span className="cyc-metric-label">{t('cycle.metricRegularity')}</span>
            <span className="cyc-metric-value">{regularityText}</span>
          </div>
          <div className="cyc-metric">
            <span className="cyc-metric-label">{t('cycle.metricLastCycle')}</span>
            <span className="cyc-metric-value">
              {stats.lastCycleLength ? t('cycle.daysN', { n: stats.lastCycleLength }) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Двомісячний розворот */}
      <div className="card">
        <div className="cyc-spread">
          {renderMonth(new Date())}
          {renderMonth(addMonths(new Date(), 1))}
        </div>
        <div className="cyc-legend">
          <span className="cyc-legend-item"><span className="cyc-sw cyc-sw--start" />{t('cycle.legend.start')}</span>
          <span className="cyc-legend-item"><span className="cyc-sw cyc-sw--period" />{t('cycle.legend.period')}</span>
          <span className="cyc-legend-item"><span className="cyc-sw cyc-sw--end" />{t('cycle.legend.end')}</span>
          <span className="cyc-legend-item"><span className="cyc-sw cyc-sw--predicted" />{t('cycle.legend.predicted')}</span>
          <span className="cyc-legend-item"><span className="cyc-sw cyc-sw--today" />{t('cycle.legend.today')}</span>
        </div>
      </div>

      {/* Фази циклу — плитками */}
      {phases.length > 0 && (
        <div className="card">
          <h3>{t('cycle.phasesTitle')}</h3>
          <div className="cyc-phase-grid">
            {PHASE_META.map((meta) => {
              const phase = phases.find((p) => p.key === meta.key)
              if (!phase) return null
              const range = phase.approx
                ? `≈ ${fmtShort(phase.from)}`
                : `${fmtShort(phase.from)} – ${fmtShort(phase.to)}`
              return (
                <div
                  key={meta.key}
                  className={`cyc-phase-tile cyc-phase-tile--${meta.dot}${phase.current ? ' cyc-phase-tile--current' : ''}`}
                >
                  <span className="cyc-phase-name">{t(`cycle.phase.${meta.key}`)}</span>
                  <span className="cyc-phase-range">{range}</span>
                  {phase.approx && <span className="cyc-phase-note">{t('cycle.phaseApprox')}</span>}
                  {phase.current && <span className="cyc-phase-now">{t('cycle.phaseNow')}</span>}
                </div>
              )
            })}
          </div>
          <p className="placeholder-text cyc-phases-note">{t('cycle.phasesNote')}</p>
        </div>
      )}

      {/* Реєстр історії менструації */}
      <div className="card">
        <h3>{t('cycle.historyRegistryTitle')}</h3>
        {records.length === 0 ? (
          <p className="placeholder-text">{t('cycle.historyEmpty')}</p>
        ) : (
          <div className="cyc-table-scroll">
            <table className="cyc-table">
              <thead>
                <tr>
                  <th>{t('cycle.col.start')}</th>
                  <th>{t('cycle.col.end')}</th>
                  <th>{t('cycle.col.periodLen')}</th>
                  <th>{t('cycle.col.cycleLen')}</th>
                  <th>{t('cycle.col.status')}</th>
                  <th className="no-print" />
                </tr>
              </thead>
              <tbody>
                {forecast.hasData && forecast.predictedDate && (
                  <tr className="cyc-row-predicted">
                    <td>{fmtShort(toApiDate(addDays(fromApiDate(forecast.predictedDate), -forecast.rangeDays)))} – {fmt(toApiDate(addDays(fromApiDate(forecast.predictedDate), forecast.rangeDays)))}</td>
                    <td className="cyc-none">—</td>
                    <td>{stats.avgPeriodLength ? `~${t('cycle.daysN', { n: stats.avgPeriodLength })}` : '—'}</td>
                    <td className="cyc-none">—</td>
                    <td><span className="cyc-badge cyc-badge--warn">{t('cycle.status.predicted')}</span></td>
                    <td className="no-print" />
                  </tr>
                )}
                {historyRows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="cyc-badge cyc-badge--start">{fmt(r.startDate)}</span></td>
                    <td>{r.endDate ? <span className="cyc-badge cyc-badge--end">{fmt(r.endDate)}</span> : <span className="cyc-none">{t('cycle.historyOngoing')}</span>}</td>
                    <td>{r.periodLen ? t('cycle.daysN', { n: r.periodLen }) : <span className="cyc-none">—</span>}</td>
                    <td>{r.cycleLen ? t('cycle.daysN', { n: r.cycleLen }) : <span className="cyc-none">—</span>}</td>
                    <td>
                      <span className={`cyc-badge ${r.endDate ? 'cyc-badge--ok' : 'cyc-badge--warn'}`}>
                        {r.endDate ? t('cycle.status.done') : t('cycle.historyOngoing')}
                      </span>
                    </td>
                    <td className="no-print">
                      <button type="button" className="cyc-del" onClick={() => handleDelete(r.id)}>
                        {t('planner.actionDelete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="placeholder-text" style={{ margin: '10px 0 0' }}>{t('cycle.manualNote')}</p>
      </div>

      {/* Налаштування циклу */}
      <div className="card no-print">
        <label className="cycle-settings-row">
          <input type="checkbox" checked={settings.reduceLoadOnHeavyDays} onChange={handleToggleReduceLoad} />
          <span>{t('cycle.reduceLoad')}</span>
        </label>
        <p className="placeholder-text">{t('cycle.reduceLoadHint')}</p>
      </div>
    </div>
  )
}
