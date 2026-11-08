import { useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import FieldHelp from '../FieldHelp'
import { setBells as apiSetBells } from '../../api/study'

// Фіксовані дефолтні дзвінки. Школяр: урок 45 хв, максимум 7 уроків. Студент: пара 90 хв, максимум 6 пар.
const PUPIL_TIMES = [
  ['08:30', '09:15'], ['09:25', '10:10'], ['10:30', '11:15'], ['11:35', '12:20'],
  ['12:35', '13:20'], ['13:30', '14:15'], ['14:25', '15:10'],
]
const STUDENT_TIMES = [
  ['08:30', '09:50'], ['10:10', '11:30'], ['11:50', '13:10'],
  ['13:30', '14:50'], ['15:10', '16:30'], ['16:50', '18:10'],
]

// Межі кількості: школяр 1–7 (дефолт — усі 7 уроків), студент 1–6 (дефолт — усі 6 пар).
const BOUNDS = {
  pupil: { min: 1, max: 7, len: 45, brk: 10, times: PUPIL_TIMES },
  student: { min: 1, max: 6, len: 90, brk: 10, times: STUDENT_TIMES },
}

// Дефолтна сітка — фіксовані часи дзвінків (за замовчуванням уся максимальна кількість).
function seedDefaults(isPupil) {
  const b = isPupil ? BOUNDS.pupil : BOUNDS.student
  return b.times.map(([startTime, endTime]) => ({ startTime, endTime }))
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
    // Якщо для цього номера є фіксований дефолтний час — беремо його, інакше рахуємо від останнього.
    const preset = b.times[rows.length]
    if (preset) {
      setRows((prev) => [...prev, { startTime: preset[0], endTime: preset[1] }])
      return
    }
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
        <h4>{t('study.tab.bells')}<FieldHelp text={t('study.bellsHelp')} label={t('fieldHelp.label')} /></h4>
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
