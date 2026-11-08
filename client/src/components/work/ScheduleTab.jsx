import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import RecurrenceFields from '../planner/RecurrenceFields'
import {
  createDefaultRecurrenceValue, ruleToRecurrenceValue, recurrenceValueToPayload, validateRecurrenceValue, DEFAULT_END_MONTHS,
} from '../../utils/recurrence'
import { getMonthGridCells, toApiDate, fromApiDate, addMonths, isSameDate, todayApiDate } from '../../utils/date'
import {
  getShiftTypes, addShiftType, updateShiftType, removeShiftType,
  getScheduleEntries, addScheduleEntry, updateScheduleEntry, removeScheduleEntry, getScheduleCalendar, getNextShift,
} from '../../api/work'
import {
  SHIFT_COLORS, SHIFT_KINDS,
  hhmm, shiftRangeOf, shiftTotalHours,
} from './workShared'

const LOCALE = { uk: 'uk-UA', en: 'en-US' }

// Округлення годин до 0.5 для показу
const round1 = (h) => Math.round(h * 2) / 2

export default function ScheduleTab({ onScheduleChange }) {
  const { t, language, weekStart, weekdays, weekdaysIso, formatClock, formatDate } = useI18n()

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
  const emptyType = { name: '', color: SHIFT_COLORS[1], startTime: '09:00', endTime: '17:00', kind: 'normal', startTime2: '', endTime2: '', onCallMultiplier: '', isActive: true }
  const [showTypeForm, setShowTypeForm] = useState(false)
  const [editingTypeId, setEditingTypeId] = useState(null)
  const [typeForm, setTypeForm] = useState(emptyType)
  const [typeError, setTypeError] = useState('')

  const openAddType = () => { setEditingTypeId(null); setTypeForm(emptyType); setTypeError(''); setShowTypeForm(true) }
  const openEditType = (tp) => {
    setEditingTypeId(tp.id)
    setTypeError('')
    setTypeForm({
      name: tp.name, color: tp.color, startTime: hhmm(tp.startTime), endTime: hhmm(tp.endTime),
      kind: tp.kind ?? 'normal', startTime2: hhmm(tp.startTime2) || '', endTime2: hhmm(tp.endTime2) || '',
      onCallMultiplier: tp.onCallMultiplier ?? '', isActive: tp.isActive,
    })
    setShowTypeForm(true)
  }
  // Бекенд (System.Text.Json → TimeOnly) очікує "HH:MM:SS"; поля <input type="time"> дають "HH:MM"
  const withSeconds = (tm) => (tm && tm.length === 5 ? `${tm}:00` : tm || null)
  const submitType = async (e) => {
    e.preventDefault()
    const name = typeForm.name.trim()
    if (!name) { setTypeError(t('work.errShiftName')); return }
    const kind = typeForm.kind ?? 'normal'
    if (kind === 'split' && (!typeForm.startTime2 || !typeForm.endTime2)) { setTypeError(t('work.errShiftSplit')); return }
    // Унікальність типів змін: не можна повторювати назву, колір чи час іншої зміни.
    const others = shiftTypes.filter((tp) => tp.id !== editingTypeId)
    if (others.some((tp) => tp.name.trim().toLowerCase() === name.toLowerCase())) { setTypeError(t('work.errTypeName')); return }
    if (others.some((tp) => tp.color === typeForm.color)) { setTypeError(t('work.errTypeColor')); return }
    if (others.some((tp) => hhmm(tp.startTime) === typeForm.startTime && hhmm(tp.endTime) === typeForm.endTime)) { setTypeError(t('work.errTypeTime')); return }
    setTypeError('')
    const payload = {
      name: typeForm.name.trim(), color: typeForm.color,
      startTime: withSeconds(typeForm.startTime), endTime: withSeconds(typeForm.endTime),
      kind,
      startTime2: kind === 'split' ? withSeconds(typeForm.startTime2) : null,
      endTime2: kind === 'split' ? withSeconds(typeForm.endTime2) : null,
      onCallMultiplier: kind === 'oncall' && typeForm.onCallMultiplier ? Number(typeForm.onCallMultiplier) : null,
      isActive: typeForm.isActive ?? true,
    }
    if (editingTypeId) await updateShiftType(editingTypeId, payload)
    else await addShiftType(payload)
    setShowTypeForm(false); setTypeForm(emptyType); setEditingTypeId(null)
    afterScheduleMutation()
  }
  const deleteType = async (id) => { await removeShiftType(id); afterScheduleMutation() }

  // Перемкнути активність типу зміни: неактивні не потрапляють у календар і у вибір графіка.
  const toggleTypeActive = async (tp) => {
    await updateShiftType(tp.id, {
      name: tp.name, color: tp.color,
      startTime: withSeconds(hhmm(tp.startTime)), endTime: withSeconds(hhmm(tp.endTime)),
      kind: tp.kind ?? 'normal',
      startTime2: tp.kind === 'split' ? withSeconds(hhmm(tp.startTime2)) : null,
      endTime2: tp.kind === 'split' ? withSeconds(hhmm(tp.endTime2)) : null,
      onCallMultiplier: tp.kind === 'oncall' ? tp.onCallMultiplier : null,
      isActive: !tp.isActive,
    })
    afterScheduleMutation()
  }

  // --- Додавання графіка: швидкий X/Y або свій (як подія календаря) ---
  const [addMode, setAddMode] = useState('quick') // quick | custom
  const [pickTypeId, setPickTypeId] = useState('')
  const [workDays, setWorkDays] = useState(5) // X: робочі дні тижня (Y=7-X вихідні)
  const [quickStart, setQuickStart] = useState(todayApiDate())
  const [customRec, setCustomRec] = useState(() => createDefaultRecurrenceValue(new Date()))
  const [scheduleError, setScheduleError] = useState('')
  const [editingEntryId, setEditingEntryId] = useState(null) // редагування наявного запису графіка
  const [showScheduleHint, setShowScheduleHint] = useState(false) // підказка про зміну графіка (за іконкою)
  const [panel, setPanel] = useState(null) // центральне вікно: 'types' | 'schedule' | null

  // Відкрити наявний запис графіка на редагування (у режимі "свій": тип зміни + повторення/дати).
  const openEditEntry = (e) => {
    setPickTypeId(String(e.shiftTypeId))
    setCustomRec(ruleToRecurrenceValue({
      type: e.ruleType, timeOfDay: e.timeOfDay, startDate: e.startDate, endDate: e.endDate,
      cycleWeeks: e.cycleWeeks, cycleAnchorDate: null, weekDaysPattern: e.weekDaysPattern,
      weekDayTimesPattern: null, intervalDays: e.intervalDays, monthDayMode: e.monthDayMode,
      monthDays: e.monthDays, monthDayTimesPattern: null,
    }))
    setAddMode('custom')
    setEditingEntryId(e.id)
    setScheduleError('')
  }

  const cancelEntryEdit = () => {
    setEditingEntryId(null)
    setCustomRec(createDefaultRecurrenceValue(new Date()))
    setScheduleError('')
  }

  // Перевірка графіка: максимум 5 записів і не можна додати ТУ САМУ зміну з перетином дат
  // (різні зміни перетинатися в графіку МОЖУТЬ). Повертає код помилки або null; editingId — виключаємо сам запис.
  const scheduleGuard = (type, startDate, endDate, editingId) => {
    if (!editingId && entries.length >= 5) return 'work.errScheduleMax'
    const clash = entries.some((e) => {
      if (e.id === editingId || e.shiftTypeId !== type.id) return false
      return e.startDate <= endDate && startDate <= (e.endDate ?? '9999-12-31')
    })
    return clash ? 'work.errScheduleOverlap' : null
  }

  const addQuick = async () => {
    const type = shiftTypes.find((x) => x.id === Number(pickTypeId))
    if (!type) { setScheduleError(t('work.errPickType')); return }
    const endDate = toApiDate(addMonths(fromApiDate(quickStart), DEFAULT_END_MONTHS))
    const errKey = scheduleGuard(type, quickStart, endDate, null)
    if (errKey) { setScheduleError(t(errKey)); return }
    setScheduleError('')
    const days = Array.from({ length: workDays }, (_, i) => i + 1).join(',')
    await addScheduleEntry({
      shiftTypeId: type.id,
      recurrence: {
        type: 'WeekCycle', timeOfDay: `${hhmm(type.startTime)}:00`,
        startDate: quickStart, endDate,
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
    const errKey = scheduleGuard(type, customRec.startDate, customRec.endDate, editingEntryId)
    if (errKey) { setScheduleError(t(errKey)); return }
    setScheduleError('')
    const body = { shiftTypeId: type.id, recurrence: recurrenceValueToPayload(customRec) }
    if (editingEntryId) await updateScheduleEntry(editingEntryId, body)
    else await addScheduleEntry(body)
    setEditingEntryId(null)
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
    return { shifts: inMonth.length, hours: Math.round(hours) }
  }, [calendar, visibleMonth])

  const today = new Date()
  const monthLabel = visibleMonth.toLocaleDateString(LOCALE[language] ?? 'uk-UA', { month: 'long', year: 'numeric' })
  const activeTypes = shiftTypes.filter((tp) => tp.isActive)

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
      {/* --- Підсумки + календар --- */}
      <div className="work-kpis">
        <div className="work-kpi-tile work-kpi-tile--accent">
          <span className="work-kpi-label">{t('work.nextShift')}{nextShift && <span className="work-kpi-name"> ({nextShift.name})</span>}</span>
          <span className="work-kpi-value">{nextShift ? `${hhmm(nextShift.startTime, formatClock)}–${hhmm(nextShift.endTime, formatClock)}` : t('work.noShifts')}</span>
        </div>
        <div className="work-kpi-tile"><span className="work-kpi-label">{t('work.hoursThisMonth')}</span><span className="work-kpi-value">{monthStats.hours} {t('work.hoursShort')}</span></div>
        <div className="work-kpi-tile"><span className="work-kpi-label">{t('work.shiftsThisMonth')}</span><span className="work-kpi-value">{monthStats.shifts}</span></div>
      </div>

      <div className="card">
        <div className="work-cal-head">
          <div className="work-cal-legend">
            {activeTypes.map((tp) => (
              <span key={tp.id} className="work-legend-dot" title={`${tp.name} ${shiftRangeOf(tp, formatClock)}`} style={{ background: tp.color }} />
            ))}
          </div>
          <div className="work-month-nav">
            <button type="button" className="work-nav-btn" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}><Icon name="chevron-left" /></button>
            <span className="work-month-label">{monthLabel}</span>
            <button type="button" className="work-nav-btn" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}><Icon name="chevron-right" /></button>
          </div>
          <div className="work-cal-actions">
            <button type="button" className="work-pill" onClick={() => setPanel('types')}>{t('work.shiftTypesTitle')}</button>
            <button type="button" className="work-pill" onClick={() => setPanel('schedule')}>{t('work.scheduleTitle')}</button>
          </div>
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
                {shifts.length > 3 ? (
                  // не більше 3 змін на день: якщо більше — показуємо позначку "забагато"
                  <span className="work-cal-toomany">{t('work.tooManyShifts')}</span>
                ) : (
                  shifts.map((s, i) => (
                    <span key={i} className="work-cal-chip" style={{ background: s.color }} title={`${s.name} ${shiftRangeOf(s, formatClock)}`}>
                      {s.name}
                    </span>
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* --- Типи змін (центральне вікно) --- */}
      {panel === 'types' && (
      <div className="work-modal-overlay" onClick={() => setPanel(null)}>
      <div className="work-modal" onClick={(e) => e.stopPropagation()}>
        <div className="work-modal-bar"><button type="button" className="work-modal-close" onClick={() => setPanel(null)} aria-label={t('common.cancel')}><Icon name="close" /></button></div>
        <div className="work-section-head">
          <h3>{t('work.shiftTypesTitle')}</h3>
          <button type="button" className="btn-outline" onClick={showTypeForm ? () => setShowTypeForm(false) : openAddType}>{showTypeForm ? t('common.cancel') : t('work.addShiftType')}</button>
        </div>
        <p className="placeholder-text">{t('work.shiftTypesHint')}</p>

        {showTypeForm && (
          <>
          <form className="work-form work-inline-form" onSubmit={submitType}>
            <label className="work-form-grow">{t('work.shiftName')}<input value={typeForm.name} maxLength={24} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder={t('work.shiftNamePlaceholder')} /></label>
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
          {typeError && <p className="task-form-error">{typeError}</p>}
          </>
        )}

        {shiftTypes.length === 0 ? (
          <p className="placeholder-text">{t('work.noShiftTypes')}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>{t('work.shiftName')}</th><th>{t('work.shiftKind')}</th><th>{t('work.shiftColor')}</th><th>{t('work.shiftTime')}</th><th>{t('work.shiftDuration')}</th><th /></tr></thead>
              <tbody>
                {shiftTypes.map((tp) => (
                  <tr key={tp.id} className={tp.isActive ? undefined : 'work-type-row--inactive'}>
                    <td>{tp.name}{!tp.isActive && <span className="work-type-off"> · {t('work.inactive')}</span>}</td>
                    <td>
                      <span className="work-kind-badge">{t(`work.shiftKind.${tp.kind ?? 'normal'}`)}</span>
                      {tp.kind === 'oncall' && tp.onCallMultiplier ? <span className="work-kind-mult"> ×{tp.onCallMultiplier}</span> : null}
                    </td>
                    <td><span className="work-color-dot" style={{ background: tp.color }} /></td>
                    <td>{shiftRangeOf(tp, formatClock)}</td>
                    <td>{round1(shiftTotalHours(tp))} {t('work.hoursShort')}</td>
                    <td className="work-row-actions">
                      <button type="button" className="work-pill work-type-toggle" onClick={() => toggleTypeActive(tp)}>{tp.isActive ? t('work.deactivate') : t('work.activate')}</button>
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
      </div>
      )}

      {/* --- Графік змін (центральне вікно) --- */}
      {panel === 'schedule' && (
      <div className="work-modal-overlay" onClick={() => setPanel(null)}>
      <div className="work-modal" onClick={(e) => e.stopPropagation()}>
        <div className="work-modal-bar"><button type="button" className="work-modal-close" onClick={() => setPanel(null)} aria-label={t('common.cancel')}><Icon name="close" /></button></div>
        <div className="work-section-head">
          <h3>{t('work.scheduleTitle')}</h3>
          <button type="button" className="work-icon-btn" onClick={() => setShowScheduleHint((v) => !v)} aria-label={t('work.scheduleHistoryHint')} title={t('work.scheduleHistoryHint')}><Icon name="info" /></button>
        </div>
        {showScheduleHint && <p className="placeholder-text work-regime-hint">{t('work.scheduleHistoryHint')}</p>}

        {shiftTypes.length === 0 ? (
          <p className="placeholder-text">{t('work.needTypeFirst')}</p>
        ) : (
          <>
            <div className="work-field-row">
              <label className="work-form-grow">{t('work.pickShiftType')}
                <select value={pickTypeId} onChange={(e) => setPickTypeId(e.target.value)}>
                  <option value="">{t('work.pickShiftTypePh')}</option>
                  {shiftTypes.filter((tp) => tp.isActive).map((tp) => <option key={tp.id} value={tp.id}>{tp.name} ({shiftRangeOf(tp, formatClock)})</option>)}
                </select>
              </label>
            </div>

            {editingEntryId ? (
              <div className="work-entry-editing">
                <Icon name="pencil" /><span>{t('work.editingEntry')}</span>
                <button type="button" className="work-pill" onClick={cancelEntryEdit}>{t('common.cancel')}</button>
              </div>
            ) : (
              <div className="work-pills work-mode-pills">
                <button type="button" className={addMode === 'quick' ? 'work-pill work-pill--active' : 'work-pill'} onClick={() => setAddMode('quick')}>{t('work.modeQuick')}</button>
                <button type="button" className={addMode === 'custom' ? 'work-pill work-pill--active' : 'work-pill'} onClick={() => setAddMode('custom')}>{t('work.modeCustom')}</button>
              </div>
            )}

            {!editingEntryId && addMode === 'quick' ? (
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
                <p className="placeholder-text">{editingEntryId ? t('work.scheduleHistoryHint') : t('work.customHint')}</p>
                <RecurrenceFields value={customRec} onChange={setCustomRec} />
                <button type="button" className="btn-accent" onClick={addCustom}>{editingEntryId ? t('common.save') : t('work.addToSchedule')}</button>
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
                <span className="work-entry-sum">
                  {summarize(e)} · {shiftRangeOf(e, formatClock)}
                  <span className="work-entry-range">{formatDate(e.startDate)}{e.endDate ? ` – ${formatDate(e.endDate)}` : ''}</span>
                </span>
                <button type="button" className="work-icon-btn" onClick={() => openEditEntry(e)} aria-label={t('common.edit')}><Icon name="pencil" /></button>
                <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => deleteEntry(e.id)} aria-label={t('common.delete')}><Icon name="trash" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  )
}
