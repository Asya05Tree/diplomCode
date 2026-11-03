import { useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { setBells as apiSetBells } from '../../api/study'

// Межі кількості пар: школяр 4–8 (дефолт 6), студент 2–5 (дефолт 3)
const BOUNDS = { pupil: { min: 4, max: 8, def: 6, len: 45, brk: 10 }, student: { min: 2, max: 5, def: 3, len: 90, brk: 10 } }

// Генеруємо типову сітку: від 08:30 підряд, кожна пара len хв + brk перерва
function seedDefaults(isPupil) {
  const b = isPupil ? BOUNDS.pupil : BOUNDS.student
  const rows = []
  let mins = 8 * 60 + 30
  for (let i = 0; i < b.def; i++) {
    const start = mins
    const end = mins + b.len
    rows.push({ startTime: hhmm(start), endTime: hhmm(end) })
    mins = end + b.brk
  }
  return rows
}

function hhmm(totalMins) {
  const h = Math.floor(totalMins / 60) % 24
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function toMins(hhmmStr) {
  const [h, m] = hhmmStr.split(':').map(Number)
  return h * 60 + m
}

// Сітка дзвінків. Дефолти й межі залежать від типу користувача; зберігається цілою сіткою (PUT).
export default function BellsTab({ bells, setBells, isPupil }) {
  const { t } = useI18n()
  const b = isPupil ? BOUNDS.pupil : BOUNDS.student
  const [rows, setRows] = useState(() => (bells.length ? bells : seedDefaults(isPupil)))
  const [savedNote, setSavedNote] = useState('')

  const change = (idx, edge, value) =>
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [edge]: value } : row)))

  const addRow = () => {
    if (rows.length >= b.max) return
    const last = rows[rows.length - 1]
    const start = last ? toMins(last.endTime) + b.brk : 8 * 60 + 30
    setRows((prev) => [...prev, { startTime: hhmm(start), endTime: hhmm(start + b.len) }])
  }

  const removeRow = (idx) => {
    if (rows.length <= b.min) return
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const save = async () => {
    const payload = rows.map((r, i) => ({ index: i + 1, startTime: `${r.startTime}:00`, endTime: `${r.endTime}:00` }))
    await apiSetBells(payload)
    setBells(rows) // оновлюємо спільний стан (розклад бере час пар звідси)
    setSavedNote(t('study.saved'))
    setTimeout(() => setSavedNote(''), 1800)
  }

  return (
    <div className="card">
      <div className="grade-head">
        <h4>{t('study.tab.bells')}</h4>
        <div className="grade-switch">
          {savedNote && <span className="study-saved-note">{savedNote}</span>}
          <button type="button" className="pill" onClick={addRow} disabled={rows.length >= b.max}>
            <Icon name="plus" /> {t('study.addBell')}
          </button>
          <button type="button" className="btn-accent" onClick={save}>
            {t('study.saveBells')}
          </button>
        </div>
      </div>
      <p className="placeholder-text">{t('study.bellsBounds', { min: b.min, max: b.max })}</p>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('study.col.pair')}</th>
              <th>{t('study.col.start')}</th>
              <th>{t('study.col.end')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <input type="time" className="time-field" value={row.startTime} onChange={(e) => change(i, 'startTime', e.target.value)} />
                </td>
                <td>
                  <input type="time" className="time-field" value={row.endTime} onChange={(e) => change(i, 'endTime', e.target.value)} />
                </td>
                <td className="study-row-actions">
                  <button
                    type="button"
                    className="study-icon-btn study-icon-btn--danger"
                    onClick={() => removeRow(i)}
                    disabled={rows.length <= b.min}
                    aria-label={t('planner.actionDelete')}
                    data-tooltip={t('planner.actionDelete')}
                  >
                    <Icon name="close" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
