import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getVaccinations, markVaccination, updateVaccination, removeVaccination } from '../../api/vaccination'
import { todayApiDate, fromApiDate, toApiDate, addMonths } from '../../utils/date'

// Вкладка "Щеплення" (розділ "Здоров'я"). Довідник доз — системний (Календар профілактичних щеплень).
// Статуси рахуємо тут із віку профілю. Інтерфейс лише переказує документ і рахує арифметику —
// жодних рекомендацій ("вам потрібно", "терміново"); тільки "за календарем мало бути у…" тощо.
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
  const [custom, setCustom] = useState({ name: '', date: todayApiDate() })

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
    await markVaccination({ customName: name, doneDate: custom.date || todayApiDate(), note: null })
    setCustom({ name: '', date: todayApiDate() })
    await reload()
  }

  const removeCustom = async (id) => {
    await removeVaccination(id)
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

  return (
    <div className="card vacc-card">
      <div className="section-title">
        <h3>{t('health.tab.vacc')}</h3>
      </div>

      {ageMonths == null && (
        <p className="vacc-agenote">{t('vaccination.noAgeHint')}</p>
      )}

      {doneCount === 0 && (
        <p className="placeholder-text">{t('vaccination.empty')}</p>
      )}

      <div className="vacc-groups">
        {groups.map((infectionDoses) => {
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
        })}
      </div>

      {/* Власні щеплення поза календарем */}
      <div className="vacc-custom">
        <div className="vacc-custom-head">{t('vaccination.customTitle')}</div>
        {customRecords.length > 0 && (
          <ul className="vacc-custom-list">
            {customRecords.map((r) => (
              <li key={r.id} className="vacc-custom-row">
                <span className="vacc-custom-name">{r.customName}</span>
                <span className="vacc-custom-date">{t('vaccination.statusDone', { date: formatDate(r.doneDate.slice(0, 10)) })}</span>
                <button type="button" className="vacc-custom-del" onClick={() => removeCustom(r.id)} aria-label={t('common.delete')}>
                  <Icon name="close" />
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
            maxLength={200}
            onChange={(e) => setCustom({ ...custom, name: e.target.value })}
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

      <p className="vacc-disclaimer">
        {t('vaccination.disclaimer')}
        {sourceText ? ` ${sourceText}` : ''}
      </p>
    </div>
  )
}
