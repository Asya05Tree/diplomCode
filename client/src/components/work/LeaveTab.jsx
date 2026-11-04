import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getLeaves, addLeave, removeLeave } from '../../api/work'
import { LEAVE_TYPES, leaveDays } from './workShared'
import { todayApiDate } from '../../utils/date'

// Відсутності — проста таблиця: тип (відпустка / лікарняний), дата початку й кінця.
export default function LeaveTab() {
  const { t, formatDate } = useI18n()
  const [leaves, setLeaves] = useState([])
  const [type, setType] = useState('vacation')
  const [start, setStart] = useState(todayApiDate())
  const [end, setEnd] = useState(todayApiDate())

  const reload = () => getLeaves().then(setLeaves).catch(() => setLeaves([]))
  useEffect(() => { reload() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!start || !end) return
    await addLeave({ type, startDate: start, endDate: end })
    await reload()
  }

  const del = async (id) => { await removeLeave(id); await reload() }

  const vacationDaysUsed = leaves.filter((l) => l.type === 'vacation').reduce((s, l) => s + leaveDays(l.startDate, l.endDate), 0)
  const sickDaysUsed = leaves.filter((l) => l.type === 'sick').reduce((s, l) => s + leaveDays(l.startDate, l.endDate), 0)

  return (
    <div className="card">
      <div className="work-section-head"><h3>{t('work.leaveTitle')}</h3></div>

      <div className="work-kpis">
        <div className="work-kpi-tile"><span className="work-kpi-label">{t('work.vacationUsed')}</span><span className="work-kpi-value">{vacationDaysUsed} {t('work.daysShort')}</span></div>
        <div className="work-kpi-tile"><span className="work-kpi-label">{t('work.sickUsed')}</span><span className="work-kpi-value">{sickDaysUsed} {t('work.daysShort')}</span></div>
      </div>

      <form className="work-form" onSubmit={submit}>
        <div className="work-form-grid">
          <label>{t('work.leaveType')}
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {LEAVE_TYPES.map((v) => <option key={v} value={v}>{t(`work.leaveKind.${v}`)}</option>)}
            </select>
          </label>
          <label>{t('work.startDate')}<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>{t('work.endDate')}<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <div className="work-form-actions"><button type="submit" className="btn-accent">{t('work.addLeave')}</button></div>
      </form>

      {leaves.length === 0 ? (
        <p className="placeholder-text">{t('work.noLeaves')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>{t('work.leaveType')}</th><th>{t('work.startDate')}</th><th>{t('work.endDate')}</th><th>{t('work.daysCol')}</th><th /></tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td><span className={`badge ${l.type === 'sick' ? 'badge--warn' : 'badge--ok'}`}>{t(`work.leaveKind.${l.type}`)}</span></td>
                  <td>{formatDate(l.startDate)}</td>
                  <td>{formatDate(l.endDate)}</td>
                  <td>{leaveDays(l.startDate, l.endDate)}</td>
                  <td className="work-row-actions">
                    <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => del(l.id)} aria-label={t('common.delete')}><Icon name="trash" /></button>
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
