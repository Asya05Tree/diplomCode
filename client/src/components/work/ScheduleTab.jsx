import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import RecurrenceFields from '../planner/RecurrenceFields'
import {
  createDefaultRecurrenceValue, recurrenceValueToPayload, validateRecurrenceValue, DEFAULT_END_MONTHS,
} from '../../utils/recurrence'
import { getMonthGridCells, toApiDate, fromApiDate, addMonths, isSameDate, todayApiDate } from '../../utils/date'
import {
  setWorkSettings, getShiftTypes, addShiftType, updateShiftType, removeShiftType,
  getScheduleEntries, addScheduleEntry, removeScheduleEntry, getScheduleCalendar, getNextShift,
} from '../../api/work'
import {
  PAY_TYPES, SHIFT_COLORS, WORK_REGIMES, WORKPLACES, SHIFT_KINDS, REGIMES_WITH_NORM,
  hhmm, shiftRangeOf, shiftTotalHours,
} from './workShared'

const LOCALE = { uk: 'uk-UA', en: 'en-US' }

// Округлення годин до 0.5 для показу
const round1 = (h) => Math.round(h * 2) / 2

export default function ScheduleTab({ settings, onSettingsChange, onScheduleChange }) {
  const { t, language, weekStart, weekdays, weekdaysIso, formatClock } = useI18n()

  // --- Профіль роботи / оплата (локальний чернетковий стан) ---
  const [profile, setProfile] = useState(settings)
  const [savedNote, setSavedNote] = useState('')
  useEffect(() => { setProfile(settings) }, [settings])

  const saveProfile = async () => {
    const regime = profile.regime ?? 'standard'
    const payload = {
      jobName: profile.jobName ?? '', position: profile.position ?? null, employer: profile.employer ?? null,
      payType: profile.payType ?? 'hourly', rate: profile.rate ? Number(profile.rate) : null,
      regime, workplace: profile.workplace ?? 'onsite',
      normHours: profile.normHours ? Number(profile.normHours) : null,
      fullRateRetained: regime === 'reduced' ? Boolean(profile.fullRateRetained) : false,
      extraVacationDays: regime === 'irregular' && profile.extraVacationDays ? Number(profile.extraVacationDays) : null,
    }
    await setWorkSettings(payload)
    onSettingsChange({ ...profile, ...payload })
    setSavedNote(t('work.saved'))
    setTimeout(() => setSavedNote(''), 1800)
  }

  // --- Типи змін, записи графіка, календар ---
  const [shiftTypes, setShiftTypes] = useState([])
  const [entries, setEntries] = useState([])
  const [nextShift, setNextShift] = useState(null)
  const [visibleMonth, setVisibleMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [calendar, setCalendar] = useState([])

  const gridRange = useMemo(() => {
    const cells = getMonthGridCells(visibleMonth.getFullYear(), visibleMonth.getMonth(), weekStart)
    return { cells, from: cells[0].date, to: cells[cells.length - 1].date }
  }, [visibleMonth, weekStart])

  const reloadTypesAndEntries = useCallback(() => {
    Promise.all([getShiftTypes(), getScheduleEntries(), getNextShift()])
      .then(([types, ent, next]) => { setShiftTypes(types); setEntries(ent); setNextShift(next) })
      .catch(() => {})
  }, [])
  useEffect(() => { reloadTypesAndEntries() }, [reloadTypesAndEntries])

  useEffect(() => {
    getScheduleCalendar(gridRange.from, gridRange.to).then(setCalendar).catch(() => setCalendar([]))
  }, [gridRange])

  const afterScheduleMutation = () => {
    reloadTypesAndEntries()
    getScheduleCalendar(gridRange.from, gridRange.to).then(setCalendar).catch(() => {})
    onScheduleChange?.()
  }

  // --- Форма типу зміни ---
  const emptyType = { name: '', color: SHIFT_COLORS[1], startTime: '09:00', endTime: '17:00', kind: 'normal', startTime2: '', endTime2: '', onCallMultiplier: '' }
  const [showTypeForm, setShowTypeForm] = useState(false)
  const [editingTypeId, setEditingTypeId] = useState(null)
  const [typeForm, setTypeForm] = useState(emptyType)

  const openAddType = () => { setEditingTypeId(null); setTypeForm(emptyType); setShowTypeForm(true) }
  const openEditType = (tp) => {
    setEditingTypeId(tp.id)
    setTypeForm({
      name: tp.name, color: tp.color, startTime: hhmm(tp.startTime), endTime: hhmm(tp.endTime),
      kind: tp.kind ?? 'normal', startTime2: hhmm(tp.startTime2) || '', endTime2: hhmm(tp.endTime2) || '',
      onCallMultiplier: tp.onCallMultiplier ?? '',
    })
    setShowTypeForm(true)
  }
  // Бекенд (System.Text.Json → TimeOnly) очікує "HH:MM:SS"; поля <input type="time"> дають "HH:MM"
  const withSeconds = (tm) => (tm && tm.length === 5 ? `${tm}:00` : tm || null)
  const submitType = async (e) => {
    e.preventDefault()
    if (!typeForm.name.trim()) return
    const kind = typeForm.kind ?? 'normal'
    if (kind === 'split' && (!typeForm.startTime2 || !typeForm.endTime2)) { return }
    const payload = {
      name: typeForm.name.trim(), color: typeForm.color,
      startTime: withSeconds(typeForm.startTime), endTime: withSeconds(typeForm.endTime),
      kind,
      startTime2: kind === 'split' ? withSeconds(typeForm.startTime2) : null,
      endTime2: kind === 'split' ? withSeconds(typeForm.endTime2) : null,
      onCallMultiplier: kind === 'oncall' && typeForm.onCallMultiplier ? Number(typeForm.onCallMultiplier) : null,
    }
    if (editingTypeId) await updateShiftType(editingTypeId, payload)
    else await addShiftType(payload)
    setShowTypeForm(false); setTypeForm(emptyType); setEditingTypeId(null)
    afterScheduleMutation()
  }
  const deleteType = async (id) => { await removeShiftType(id); afterScheduleMutation() }

  // --- Додавання графіка: швидкий X/Y або свій (як подія календаря) ---
  const [addMode, setAddMode] = useState('quick') // quick | custom
  const [pickTypeId, setPickTypeId] = useState('')
  const [workDays, setWorkDays] = useState(5) // X: робочі дні тижня (Y=7-X вихідні)
  const [quickStart, setQuickStart] = useState(todayApiDate())
  const [customRec, setCustomRec] = useState(() => createDefaultRecurrenceValue(new Date()))
  const [scheduleError, setScheduleError] = useState('')

  const addQuick = async () => {
    const type = shiftTypes.find((x) => x.id === Number(pickTypeId))
    if (!type) { setScheduleError(t('work.errPickType')); return }
    setScheduleError('')
    const days = Array.from({ length: workDays }, (_, i) => i + 1).join(',')
    await addScheduleEntry({
      shiftTypeId: type.id,
      recurrence: {
        type: 'WeekCycle', timeOfDay: `${hhmm(type.startTime)}:00`,
        startDate: quickStart, endDate: toApiDate(addMonths(fromApiDate(quickStart), DEFAULT_END_MONTHS)),
        cycleWeeks: 1, cycleAnchorDate: null, weekDaysPattern: `0:${days}`,
        weekDayTimesPattern: null, intervalDays: null, monthDayMode: null, monthDays: null, monthDayTimesPattern: null,
      },
    })
    afterScheduleMutation()
  }

  const addCustom = async () => {
    const type = shiftTypes.find((x) => x.id === Number(pickTypeId))
    if (!type) { setScheduleError(t('work.errPickType')); return }
    const errCode = validateRecurrenceValue(customRec)
    if (errCode) { setScheduleError(t(`taskForm.${errCode}`)); return }
    setScheduleError('')
    await addScheduleEntry({ shiftTypeId: type.id, recurrence: recurrenceValueToPayload(customRec) })
    setCustomRec(createDefaultRecurrenceValue(new Date()))
    afterScheduleMutation()
  }

  const deleteEntry = async (id) => { await removeScheduleEntry(id); afterScheduleMutation() }

  // --- Календар: мапа дата -> перелік змін; підсумки місяця ---
  const byDate = useMemo(() => {
    const map = new Map()
    for (const s of calendar) {
      if (!map.has(s.date)) map.set(s.date, [])
      map.get(s.date).push(s)
    }
    return map
  }, [calendar])

  const monthStats = useMemo(() => {
    const m = visibleMonth.getMonth()
    const inMonth = calendar.filter((s) => fromApiDate(s.date).getMonth() === m)
    const hours = inMonth.reduce((sum, s) => sum + shiftTotalHours(s), 0)
    // Оплачувані години: зміни-чергування тарифікуються з коефіцієнтом (окрема тарифікація on-call)
    const paidHours = inMonth.reduce((sum, s) => sum + shiftTotalHours(s) * (s.kind === 'oncall' && s.onCallMultiplier ? Number(s.onCallMultiplier) : 1), 0)
    return { shifts: inMonth.length, hours: Math.round(hours), paidHours }
  }, [calendar, visibleMonth])

  const earnings = profile?.payType === 'hourly' && profile?.rate
    ? Math.round(monthStats.paidHours * Number(profile.rate))
    : null

  const today = new Date()
  const monthLabel = visibleMonth.toLocaleDateString(LOCALE[language] ?? 'uk-UA', { month: 'long', year: 'numeric' })

  // Короткий опис запису графіка
  const summarize = (e) => {
    if (e.ruleType === 'WeekCycle') {
      const days = (e.weekDaysPattern ?? '').split('|')[0]?.split(':')[1] ?? ''
      const labels = days.split(',').filter(Boolean).map((d) => weekdaysIso[Number(d) - 1]).join(', ')
      const cyc = e.cycleWeeks > 1 ? ` · ${t('work.cycleWeeksShort', { n: e.cycleWeeks })}` : ''
      return `${labels || '—'}${cyc}`
    }
    if (e.ruleType === 'EveryNDays') return t('work.everyNDays', { n: e.intervalDays })
    if (e.ruleType === 'MonthDays') return e.monthDayMode === 'Specific' ? (e.monthDays ?? '').split(',').join(', ') : t(`recurrence.monthDayMode.${e.monthDayMode}`)
    return t('recurrence.type.Manual')
  }

  return (
    <div className="work-schedule">
      {/* --- Профіль роботи й оплата --- */}
      <div className="card">
        <div className="work-section-head">
          <h3>{t('work.profileTitle')}</h3>
          <div className="work-save-row">
            {savedNote && <span className="work-saved-note">{savedNote}</span>}
            <button type="button" className="btn-accent" onClick={saveProfile}>{t('common.save')}</button>
          </div>
        </div>
        <div className="work-form-grid">
          <label>{t('work.jobName')}<input value={profile?.jobName ?? ''} onChange={(e) => setProfile({ ...profile, jobName: e.target.value })} /></label>
          <label>{t('work.position')}<input value={profile?.position ?? ''} onChange={(e) => setProfile({ ...profile, position: e.target.value })} /></label>
          <label>{t('work.employer')}<input value={profile?.employer ?? ''} onChange={(e) => setProfile({ ...profile, employer: e.target.value })} /></label>
          <label>{t('work.rate')} <span className="work-optional">({t(`work.rateUnit.${profile?.payType ?? 'hourly'}`)})</span>
            <input type="number" min="0" value={profile?.rate ?? ''} onChange={(e) => setProfile({ ...profile, rate: e.target.value })} />
          </label>
        </div>
        <div className="work-field-row">
          <span className="work-field-label">{t('work.payLabel')}</span>
          <div className="work-pills">
            {PAY_TYPES.map((p) => (
              <button key={p} type="button" className={profile?.payType === p ? 'work-pill work-pill--active' : 'work-pill'} onClick={() => setProfile({ ...profile, payType: p })}>
                {t(`work.pay.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Режим і місце роботи (спеціальні формати організації праці) */}
        <div className="work-form-grid">
          <label>{t('work.regime')}
            <select value={profile?.regime ?? 'standard'} onChange={(e) => setProfile({ ...profile, regime: e.target.value })}>
              {WORK_REGIMES.map((r) => <option key={r} value={r}>{t(`work.regime.${r}`)}</option>)}
            </select>
          </label>
          <label>{t('work.workplace')}
            <select value={profile?.workplace ?? 'onsite'} onChange={(e) => setProfile({ ...profile, workplace: e.target.value })}>
              {WORKPLACES.map((w) => <option key={w} value={w}>{t(`work.workplace.${w}`)}</option>)}
            </select>
          </label>
          {REGIMES_WITH_NORM.includes(profile?.regime) && (
            <label>{t('work.normHours')} <span className="work-optional">({t('work.perWeek')})</span>
              <input type="number" min="0" max="60" value={profile?.normHours ?? ''} onChange={(e) => setProfile({ ...profile, normHours: e.target.value })} />
            </label>
          )}
          {profile?.regime === 'irregular' && (
            <label>{t('work.extraVacation')} <span className="work-optional">({t('work.daysShort')})</span>
              <input type="number" min="0" max="35" value={profile?.extraVacationDays ?? ''} onChange={(e) => setProfile({ ...profile, extraVacationDays: e.target.value })} />
            </label>
          )}
        </div>
        {profile?.regime === 'reduced' && (
          <label className="work-check-row">
            <input type="checkbox" checked={Boolean(profile?.fullRateRetained)} onChange={(e) => setProfile({ ...profile, fullRateRetained: e.target.checked })} />
            {t('work.fullRateRetained')}
          </label>
        )}
        {profile?.regime && profile.regime !== 'standard' && (
          <p className="placeholder-text work-regime-hint">{t(`work.regimeHint.${profile.regime}`)}</p>
        )}
      </div>

      {/* --- Підсумки + календар --- */}
      <div className="work-kpis">
        <div className="work-kpi-tile work-kpi-tile--accent">
          <span className="work-kpi-label">{t('work.nextShift')}</span>
          <span className="work-kpi-value">{nextShift ? `${hhmm(nextShift.startTime, formatClock)}–${hhmm(nextShift.endTime, formatClock)}` : '—'}</span>
          <span className="work-kpi-sub">{nextShift ? `${nextShift.name}` : t('work.noShifts')}</span>
        </div>
        <div className="work-kpi-tile"><span className="work-kpi-label">{t('work.hoursThisMonth')}</span><span className="work-kpi-value">{monthStats.hours} {t('work.hoursShort')}</span></div>
        <div className="work-kpi-tile"><span className="work-kpi-label">{t('work.shiftsThisMonth')}</span><span className="work-kpi-value">{monthStats.shifts}</span></div>
        {earnings != null && <div className="work-kpi-tile"><span className="work-kpi-label">{t('work.earningsApprox')}</span><span className="work-kpi-value">≈ {earnings}</span></div>}
      </div>

      <div className="card">
        <div className="work-month-nav">
          <button type="button" className="work-nav-btn" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}><Icon name="chevron-left" /></button>
          <span className="work-month-label">{monthLabel}</span>
          <button type="button" className="work-nav-btn" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}><Icon name="chevron-right" /></button>
        </div>
        <div className="work-cal-weekdays">
          {weekdays.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="work-cal-grid">
          {gridRange.cells.map(({ date, inCurrentMonth }) => {
            const key = toApiDate(date)
            const shifts = byDate.get(key) ?? []
            const cls = ['work-cal-day']
            if (!inCurrentMonth) cls.push('work-cal-day--muted')
            if (isSameDate(date, today)) cls.push('work-cal-day--today')
            if (nextShift && key === nextShift.date) cls.push('work-cal-day--next')
            return (
              <div key={key} className={cls.join(' ')}>
                <span className="work-cal-num">{date.getDate()}</span>
                {shifts.slice(0, 1).map((s, i) => (
                  <span key={i} className="work-cal-chip" style={{ background: s.color }} title={`${s.name} ${shiftRangeOf(s, formatClock)}`}>
                    {s.name}
                  </span>
                ))}
                {shifts.length > 1 && <span className="work-cal-more">+{shifts.length - 1}</span>}
              </div>
            )
          })}
        </div>
        {shiftTypes.length > 0 && (
          <div className="work-legend">
            {shiftTypes.map((tp) => (
              <span key={tp.id} className="work-legend-item"><span className="work-legend-dot" style={{ background: tp.color }} />{tp.name} {shiftRangeOf(tp, formatClock)}</span>
            ))}
          </div>
        )}
      </div>

      {/* --- Типи змін --- */}
      <div className="card">
        <div className="work-section-head">
          <h3>{t('work.shiftTypesTitle')}</h3>
          <button type="button" className="btn-outline" onClick={showTypeForm ? () => setShowTypeForm(false) : openAddType}>{showTypeForm ? t('common.cancel') : t('work.addShiftType')}</button>
        </div>
        <p className="placeholder-text">{t('work.shiftTypesHint')}</p>

        {showTypeForm && (
          <form className="work-form work-inline-form" onSubmit={submitType}>
            <label className="work-form-grow">{t('work.shiftName')}<input value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder={t('work.shiftNamePlaceholder')} /></label>
            <label>{t('work.shiftKind')}
              <select value={typeForm.kind} onChange={(e) => setTypeForm({ ...typeForm, kind: e.target.value })}>
                {SHIFT_KINDS.map((k) => <option key={k} value={k}>{t(`work.shiftKind.${k}`)}</option>)}
              </select>
            </label>
            <label>{typeForm.kind === 'split' ? t('work.shiftStart1') : t('work.shiftStart')}<input type="time" value={typeForm.startTime} onChange={(e) => setTypeForm({ ...typeForm, startTime: e.target.value })} /></label>
            <label>{typeForm.kind === 'split' ? t('work.shiftEnd1') : t('work.shiftEnd')}<input type="time" value={typeForm.endTime} onChange={(e) => setTypeForm({ ...typeForm, endTime: e.target.value })} /></label>
            {typeForm.kind === 'split' && (
              <>
                <label>{t('work.shiftStart2')}<input type="time" value={typeForm.startTime2} onChange={(e) => setTypeForm({ ...typeForm, startTime2: e.target.value })} /></label>
                <label>{t('work.shiftEnd2')}<input type="time" value={typeForm.endTime2} onChange={(e) => setTypeForm({ ...typeForm, endTime2: e.target.value })} /></label>
              </>
            )}
            {typeForm.kind === 'oncall' && (
              <label>{t('work.onCallMultiplier')}<input type="number" min="1" step="0.1" placeholder="1.5" value={typeForm.onCallMultiplier} onChange={(e) => setTypeForm({ ...typeForm, onCallMultiplier: e.target.value })} /></label>
            )}
            <div className="work-color-field">
              <span className="work-field-label">{t('work.shiftColor')}</span>
              <div className="work-color-swatches">
                {SHIFT_COLORS.map((c) => (
                  <button key={c} type="button" className={typeForm.color === c ? 'work-swatch work-swatch--active' : 'work-swatch'} style={{ background: c }} onClick={() => setTypeForm({ ...typeForm, color: c })} aria-label={c} />
                ))}
              </div>
            </div>
            <button type="submit" className="btn-accent">{t('common.save')}</button>
          </form>
        )}

        {shiftTypes.length === 0 ? (
          <p className="placeholder-text">{t('work.noShiftTypes')}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>{t('work.shiftName')}</th><th>{t('work.shiftKind')}</th><th>{t('work.shiftColor')}</th><th>{t('work.shiftTime')}</th><th>{t('work.shiftDuration')}</th><th /></tr></thead>
              <tbody>
                {shiftTypes.map((tp) => (
                  <tr key={tp.id}>
                    <td>{tp.name}</td>
                    <td>
                      <span className="work-kind-badge">{t(`work.shiftKind.${tp.kind ?? 'normal'}`)}</span>
                      {tp.kind === 'oncall' && tp.onCallMultiplier ? <span className="work-kind-mult"> ×{tp.onCallMultiplier}</span> : null}
                    </td>
                    <td><span className="work-color-dot" style={{ background: tp.color }} /></td>
                    <td>{shiftRangeOf(tp, formatClock)}</td>
                    <td>{round1(shiftTotalHours(tp))} {t('work.hoursShort')}</td>
                    <td className="work-row-actions">
                      <button type="button" className="work-icon-btn" onClick={() => openEditType(tp)} aria-label={t('common.edit')}><Icon name="pencil" /></button>
                      <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => deleteType(tp.id)} aria-label={t('common.delete')}><Icon name="trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- Налаштування графіка (додавання змін у графік) --- */}
      <div className="card">
        <div className="work-section-head"><h3>{t('work.scheduleTitle')}</h3></div>

        {shiftTypes.length === 0 ? (
          <p className="placeholder-text">{t('work.needTypeFirst')}</p>
        ) : (
          <>
            <div className="work-field-row">
              <label className="work-form-grow">{t('work.pickShiftType')}
                <select value={pickTypeId} onChange={(e) => setPickTypeId(e.target.value)}>
                  <option value="">{t('work.pickShiftTypePh')}</option>
                  {shiftTypes.map((tp) => <option key={tp.id} value={tp.id}>{tp.name} ({shiftRangeOf(tp, formatClock)})</option>)}
                </select>
              </label>
            </div>

            <div className="work-pills work-mode-pills">
              <button type="button" className={addMode === 'quick' ? 'work-pill work-pill--active' : 'work-pill'} onClick={() => setAddMode('quick')}>{t('work.modeQuick')}</button>
              <button type="button" className={addMode === 'custom' ? 'work-pill work-pill--active' : 'work-pill'} onClick={() => setAddMode('custom')}>{t('work.modeCustom')}</button>
            </div>

            {addMode === 'quick' ? (
              <div className="work-quick">
                <p className="placeholder-text">{t('work.quickHint')}</p>
                <div className="work-field-row">
                  <label>{t('work.workDays')}
                    <select value={workDays} onChange={(e) => setWorkDays(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5, 6].map((x) => <option key={x} value={x}>{x} / {7 - x}</option>)}
                    </select>
                  </label>
                  <label>{t('work.startDate')}<input type="date" value={quickStart} onChange={(e) => setQuickStart(e.target.value)} /></label>
                  <span className="work-quick-note">{t('work.quickPattern', { work: workDays, rest: 7 - workDays })}</span>
                </div>
                <button type="button" className="btn-accent" onClick={addQuick}>{t('work.addToSchedule')}</button>
              </div>
            ) : (
              <div className="work-custom">
                <p className="placeholder-text">{t('work.customHint')}</p>
                <RecurrenceFields value={customRec} onChange={setCustomRec} />
                <button type="button" className="btn-accent" onClick={addCustom}>{t('work.addToSchedule')}</button>
              </div>
            )}
            {scheduleError && <p className="task-form-error">{scheduleError}</p>}
          </>
        )}

        {entries.length > 0 && (
          <div className="work-entries">
            <h4>{t('work.scheduleEntries')}</h4>
            {entries.map((e) => (
              <div key={e.id} className="work-entry-row">
                <span className="work-color-dot" style={{ background: e.color }} />
                <span className="work-entry-name">{e.shiftTypeName}</span>
                <span className="work-entry-sum">{summarize(e)} · {shiftRangeOf(e, formatClock)}</span>
                <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => deleteEntry(e.id)} aria-label={t('common.delete')}><Icon name="trash" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
