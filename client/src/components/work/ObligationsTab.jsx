import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getObligations, addObligation, updateObligation, removeObligation } from '../../api/work'

// Робочі зобов'язання та планування процесу: простий перелік із опційним дедлайном і прапорцем
// виконання. Виконане опускається донизу; найближчий дедлайн — угорі.
export default function ObligationsTab() {
  const { t, formatDate } = useI18n()
  const [items, setItems] = useState([])
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [dueDate, setDueDate] = useState('')

  const reload = () => getObligations().then(setItems).catch(() => setItems([]))
  useEffect(() => { reload() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await addObligation({ title: title.trim(), note: note.trim() || null, dueDate: dueDate || null })
    setTitle('')
    setNote('')
    setDueDate('')
    await reload()
  }

  const toggle = async (o) => {
    await updateObligation(o.id, { title: o.title, note: o.note, dueDate: o.dueDate, isDone: !o.isDone })
    await reload()
  }

  const del = async (id) => { await removeObligation(id); await reload() }

  return (
    <div className="card">
      <div className="work-section-head"><h3>{t('work.obligationsTitle')}</h3></div>

      <form className="work-form work-inline-form" onSubmit={submit}>
        <label className="work-form-grow">{t('work.obligationTitle')}<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('work.obligationPlaceholder')} /></label>
        <label className="work-form-grow">{t('work.obligationNote')} <span className="work-optional">({t('work.optional')})</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <label>{t('work.obligationDue')} <span className="work-optional">({t('work.optional')})</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <button type="submit" className="btn-accent">{t('work.addObligation')}</button>
      </form>

      {items.length === 0 ? (
        <p className="placeholder-text">{t('work.noObligations')}</p>
      ) : (
        <div className="work-obl-list">
          {items.map((o) => (
            <div key={o.id} className={o.isDone ? 'work-obl-row work-obl-row--done' : 'work-obl-row'}>
              <button type="button" className="work-obl-check" onClick={() => toggle(o)} aria-label={t('work.toggleDone')}>
                {o.isDone ? <Icon name="check-circle" /> : <span className="work-obl-box" />}
              </button>
              <div className="work-obl-main">
                <span className="work-obl-title">{o.title}</span>
                {o.note && <span className="work-obl-note">{o.note}</span>}
              </div>
              {o.dueDate && <span className="work-obl-due">{formatDate(o.dueDate)}</span>}
              <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => del(o.id)} aria-label={t('common.delete')}><Icon name="trash" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
