import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getVaccinations, markVaccination, updateVaccination, removeVaccination } from '../../api/vaccination'
import { todayApiDate, fromApiDate, toApiDate, addMonths } from '../../utils/date'

// Вкладка "Щеплення" (розділ "Здоров'я"). Довідник доз — системний (Календар профілактичних щеплень).
// Статуси рахуємо тут із віку профілю. Інтерфейс лише переказує документ і рахує арифметику —
// жодних рекомендацій ("вам потрібно", "терміново"); тільки "за календарем мало бути у…" тощо.
//
// Організація — за вкладками: "Всі щеплення" (власні поза календарем — нагорі, далі довідник за
// інфекціями), по вкладці на кожну інфекцію (Гепатит, Туберкульоз, …) та "Інше" — власні щеплення
// користувача з редагованими назвою, кількістю доз і датою. Джерело й застереження сховані під "!".
//
// props:
//   profile — { birthYear } з /api/health-profile (вік беремо звідси, окремо не питаємо)
//   onPlanVisit(dateApi, label) — відкриває наявну модалку планування візиту з підставленою датою
export default function VaccinationsTab({ profile, onPlanVisit }) {
  const { t, language, formatDate } = useI18n()
  const [doses, setDoses] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [custom, setCustom] = useState({ name: '', doseCount: '', date: todayApiDate() })
  const [activeTab, setActiveTab] = useState('all') // 'all' | <infectionKey> | 'custom'
  const [showSource, setShowSource] = useState(false) // "!" — джерело/застереження
  const [edits, setEdits] = useState({}) // id -> { customName?, doseCount?, date? } для власних записів

  useEffect(() => {
    let cancelled = false
    getVaccinations()
      .then((data) => {
        if (cancelled) return
        setDoses(data?.doses ?? [])
        setRecords(data?.records ?? [])
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Вік користувача в місяцях (приблизно: у профілі лише рік народження, без місяця).
  const currentYear = new Date().getFullYear()
  const ageMonths = profile?.birthYear != null ? (currentYear - profile.birthYear) * 12 : null

  const recByDose = useMemo(() => {
    const m = new Map()
    for (const r of records) if (r.vaccineDoseId != null) m.set(r.vaccineDoseId, r)
    return m
  }, [records])

  // Власні щеплення (поза календарем): записи без посилання на дозу довідника.
  const customRecords = useMemo(() => records.filter((r) => r.vaccineDoseId == null), [records])

  // Групування доз за інфекцією зі збереженням порядку довідника (SortOrder).
  const groups = useMemo(() => {
    const byKey = new Map()
    for (const d of doses) {
      if (!byKey.has(d.infectionKey)) byKey.set(d.infectionKey, [])
      byKey.get(d.infectionKey).push(d)
    }
    return [...byKey.values()]
  }, [doses])

  const infectionName = (d) => (language === 'en' ? d.infectionEn : d.infectionUk)
  const sourceText = doses[0]?.source || ''

  // Коротка вікова мітка: "6 р.", "1 р. 6 міс.", "при народженні".
  const ageLabel = (months) => {
    if (months <= 0) return t('vaccination.atBirth')
    const y = Math.floor(months / 12)
    const mo = months % 12
    const parts = []
    if (y > 0) parts.push(t('vaccination.yShort', { n: y }))
    if (mo > 0) parts.push(t('vaccination.moShort', { n: mo }))
    return parts.join(' ')
  }

  // Базова дата для дози "за інтервалом": дата найпізнішої ВИКОНАНОЇ попередньої дози тієї ж інфекції.
  const intervalBase = (dose, infectionDoses) => {
    let best = null
    for (const d of infectionDoses) {
      if (d.doseNumber >= dose.doseNumber) continue
      const r = recByDose.get(d.id)
      if (!r) continue
      const dt = r.doneDate.slice(0, 10)
      if (best === null || dt > best) best = dt
    }
    return best
  }

  // Статус одного рядка-дози (об'єкт для рендера).
  const statusOf = (dose, infectionDoses) => {
    const rec = recByDose.get(dose.id)
    if (rec) return { kind: 'done', date: rec.doneDate.slice(0, 10), recId: rec.id }
    if (dose.ruleType === 'Interval') {
      const base = intervalBase(dose, infectionDoses)
      if (!base) return { kind: 'needPrev' }
      const nextApi = toApiDate(addMonths(fromApiDate(base), dose.ruleValueMonths))
      return { kind: 'interval', date: nextApi, overdue: nextApi < todayApiDate() }
    }
    // Age
    if (ageMonths == null) return { kind: 'noAge', label: ageLabel(dose.ruleValueMonths) }
    const label = ageLabel(dose.ruleValueMonths)
    return ageMonths < dose.ruleValueMonths
      ? { kind: 'upcoming', label }
      : { kind: 'overdue', label }
  }

  const reload = async () => {
    const data = await getVaccinations().catch(() => null)
    if (data) { setDoses(data.doses ?? []); setRecords(data.records ?? []) }
  }

  const toggleDose = async (dose, st) => {
    if (st.kind === 'done') {
      await removeVaccination(st.recId)
    } else {
      await markVaccination({ doseId: dose.id, doneDate: todayApiDate(), note: null })
    }
    await reload()
  }

  const changeDate = async (recId, date, note) => {
    if (!date) return
    await updateVaccination(recId, { doneDate: date, note: note ?? null })
    await reload()
  }

  const addCustom = async () => {
    const name = custom.name.trim()
    if (!name) return
    const dc = custom.doseCount === '' ? null : Number(custom.doseCount)
    await markVaccination({ customName: name, doseCount: dc, doneDate: custom.date || todayApiDate(), note: null })
    setCustom({ name: '', doseCount: '', date: todayApiDate() })
    await reload()
  }

  const removeCustom = async (id) => {
    await removeVaccination(id)
    await reload()
  }

  // --- Редагування власних записів (назва / кількість доз / дата) ---
  const editVal = (r, field) => {
    const e = edits[r.id]
    if (e && field in e) return e[field]
    if (field === 'customName') return r.customName || ''
    if (field === 'doseCount') return r.doseCount ?? ''
    return r.doneDate.slice(0, 10) // date
  }
  const setEdit = (id, field, val) => setEdits((p) => ({ ...p, [id]: { ...p[id], [field]: val } }))
  const clearEdit = (id) => setEdits((p) => { const n = { ...p }; delete n[id]; return n })

  // Зберегти власний запис. Порожню назву не приймаємо (назва обов'язкова). Після збереження —
  // перезавантажуємо й скидаємо локальне редагування цього запису.
  const persistCustom = async (r) => {
    const e = edits[r.id]
    if (!e) return
    const name = (e.customName ?? r.customName ?? '').trim()
    if (!name) { clearEdit(r.id); return }
    const dcRaw = e.doseCount ?? r.doseCount
    const dc = dcRaw === '' || dcRaw == null ? null : Number(dcRaw)
    const date = e.date ?? r.doneDate.slice(0, 10)
    await updateVaccination(r.id, { doneDate: date, customName: name, doseCount: dc, note: null })
    clearEdit(r.id)
    await reload()
  }

  // Текст статусу для рядка (лише переказ документа + арифметика).
  const statusText = (st) => {
    switch (st.kind) {
      case 'done': return t('vaccination.statusDone', { date: formatDate(st.date) })
      case 'upcoming': return t('vaccination.statusUpcoming', { age: st.label })
      case 'overdue': return t('vaccination.statusOverdue', { age: st.label })
      case 'noAge': return t('vaccination.statusByAge', { age: st.label })
      case 'interval':
        return st.overdue
          ? t('vaccination.statusIntervalOverdue', { date: formatDate(st.date) })
          : t('vaccination.statusIntervalNext', { date: formatDate(st.date) })
      case 'needPrev': return t('vaccination.statusNeedPrev')
      default: return ''
    }
  }

  if (loading) return <div className="card"><p className="placeholder-text">{t('common.loading')}</p></div>
  if (error) return <div className="card"><p className="placeholder-text">{t('common.error')}</p></div>

  const doneCount = records.length

  // Один довідковий блок інфекції (чекліст доз).
  const renderGroup = (infectionDoses) => {
    const head = infectionDoses[0]
    return (
      <div key={head.infectionKey} className="vacc-group">
        <div className="vacc-group-head">{infectionName(head)}</div>
        <ul className="vacc-doses">
          {infectionDoses.map((dose) => {
            const st = statusOf(dose, infectionDoses)
            const done = st.kind === 'done'
            const canPlan = st.kind === 'interval' && !st.overdue
            return (
              <li key={dose.id} className={done ? 'vacc-dose vacc-dose--done' : 'vacc-dose'}>
                <label className="vacc-check">
                  <input type="checkbox" checked={done} onChange={() => toggleDose(dose, st)} />
                  <span className="vacc-dose-name">{t('vaccination.doseN', { n: dose.doseNumber })}</span>
                </label>

                <span className={`vacc-status vacc-status--${st.kind}`}>{statusText(st)}</span>

                {done && (
                  <input
                    type="date"
                    className="vacc-date"
                    value={st.date}
                    onChange={(e) => changeDate(st.recId, e.target.value, null)}
                  />
                )}

                {canPlan && (
                  <button
                    type="button"
                    className="vacc-plan-btn"
                    onClick={() => onPlanVisit(st.date, `${infectionName(head)} · ${t('vaccination.doseN', { n: dose.doseNumber })}`)}
                  >
                    <Icon name="calendar" /> {t('checkup.plan')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  // Власні щеплення поза календарем: редаговані назва / кількість доз / дата + видалення.
  const renderCustom = () => (
    <div className="vacc-custom">
      <div className="vacc-custom-head">{t('vaccination.customTitle')}</div>
      {customRecords.length === 0 ? (
        <p className="placeholder-text">{t('vaccination.customEmpty')}</p>
      ) : (
        <ul className="vacc-custom-list">
          {customRecords.map((r) => (
            <li key={r.id} className="vacc-custom-row vacc-custom-row--edit">
              <input
                type="text"
                className="vacc-custom-name-input"
                value={editVal(r, 'customName')}
                maxLength={60}
                onChange={(e) => setEdit(r.id, 'customName', e.target.value)}
                onBlur={() => persistCustom(r)}
                aria-label={t('vaccination.customPlaceholder')}
              />
              <span className="vacc-custom-count">
                <input
                  type="number"
                  className="vacc-custom-count-input"
                  min={1}
                  max={20}
                  step={1}
                  placeholder={t('vaccination.doseCountPlaceholder')}
                  value={editVal(r, 'doseCount')}
                  onChange={(e) => setEdit(r.id, 'doseCount', e.target.value)}
                  onBlur={() => persistCustom(r)}
                  aria-label={t('vaccination.doseCount')}
                />
                <span className="vacc-custom-count-unit">{t('vaccination.doseCount')}</span>
              </span>
              <input
                type="date"
                className="vacc-custom-date-input"
                value={editVal(r, 'date')}
                onChange={(e) => { setEdit(r.id, 'date', e.target.value) }}
                onBlur={() => persistCustom(r)}
                aria-label={t('checkup.date')}
              />
              <button type="button" className="vacc-custom-del" onClick={() => removeCustom(r.id)} aria-label={t('common.delete')}>
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="vacc-custom-form">
        <input
          type="text"
          value={custom.name}
          placeholder={t('vaccination.customPlaceholder')}
          maxLength={60}
          onChange={(e) => setCustom({ ...custom, name: e.target.value })}
        />
        <input
          type="number"
          className="vacc-custom-count-input"
          min={1}
          max={20}
          step={1}
          placeholder={t('vaccination.doseCountPlaceholder')}
          value={custom.doseCount}
          onChange={(e) => setCustom({ ...custom, doseCount: e.target.value })}
          aria-label={t('vaccination.doseCount')}
        />
        <input
          type="date"
          value={custom.date}
          onChange={(e) => setCustom({ ...custom, date: e.target.value })}
        />
        <button type="button" className="btn-ghost" onClick={addCustom} disabled={!custom.name.trim()}>
          <Icon name="plus" /> {t('vaccination.customAdd')}
        </button>
      </div>
    </div>
  )

  // Вкладки: Всі + по інфекції + Інше.
  const tabs = [
    { id: 'all', label: t('vaccination.tabAll') },
    ...groups.map((g) => ({ id: g[0].infectionKey, label: infectionName(g[0]) })),
    { id: 'custom', label: t('vaccination.tabOther') },
  ]
  const activeGroup = groups.find((g) => g[0].infectionKey === activeTab)

  return (
    <div className="card vacc-card">
      <div className="section-title">
        <h3>{t('health.tab.vacc')}</h3>
        <button
          type="button"
          className={showSource ? 'vacc-info-btn vacc-info-btn--on' : 'vacc-info-btn'}
          onClick={() => setShowSource((v) => !v)}
          aria-expanded={showSource}
          aria-label={t('vaccination.sourceToggle')}
          title={t('vaccination.sourceToggle')}
        >
          <Icon name="info" />
        </button>
      </div>

      {showSource && (
        <p className="vacc-disclaimer">
          {t('vaccination.disclaimer')}
          {sourceText ? ` ${sourceText}` : ''}
        </p>
      )}

      {ageMonths == null && (
        <p className="vacc-agenote">{t('vaccination.noAgeHint')}</p>
      )}

      {doneCount === 0 && activeTab !== 'custom' && (
        <p className="placeholder-text">{t('vaccination.empty')}</p>
      )}

      <div className="vacc-tabs">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={activeTab === tb.id ? 'pill pill--active' : 'pill'}
            onClick={() => setActiveTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {activeTab === 'custom' ? (
        renderCustom()
      ) : activeTab === 'all' ? (
        <>
          {/* Поза календарем — нагорі */}
          {renderCustom()}
          <div className="vacc-groups">
            {groups.map((g) => renderGroup(g))}
          </div>
        </>
      ) : (
        <div className="vacc-groups">
          {activeGroup && renderGroup(activeGroup)}
        </div>
      )}
    </div>
  )
}
