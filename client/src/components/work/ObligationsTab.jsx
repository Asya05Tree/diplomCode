import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getObligations, addObligation, removeObligation } from '../../api/work'

// Зобов'язання — статичний перелік того, що людина робить на посаді (обов'язки ролі): назва + опис.
// Без дедлайнів і статусів — для планування задач із дедлайнами є окрема вкладка "Планування процесу".
export default function ObligationsTab() {
  const { t } = useI18n()
  const [items, setItems] = useState([])
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')

  const reload = () => getObligations().then(setItems).catch(() => setItems([]))
  useEffect(() => { reload() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await addObligation({ title: title.trim(), note: note.trim() || null, dueDate: null, isDone: false })
    setTitle('')
    setNote('')
    await reload()
  }

  const del = async (id) => { await removeObligation(id); await reload() }

  return (
    <div className="card">
      <div className="work-section-head"><h3>{t('work.obligationsTitle')}</h3></div>
      <p className="work-regime-hint">{t('work.obligationsHint')}</p>

      <form className="work-form work-inline-form" onSubmit={submit}>
        <label className="work-form-grow">{t('work.obligationTitle')}<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('work.obligationPlaceholder')} /></label>
        <label className="work-form-grow">{t('work.obligationNote')} <span className="work-optional">({t('work.optional')})</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <button type="submit" className="btn-accent">{t('work.addObligation')}</button>
      </form>

      {items.length === 0 ? (
        <p className="placeholder-text">{t('work.noObligations')}</p>
      ) : (
        <ul className="work-duty-list">
          {items.map((o) => (
            <li key={o.id} className="work-duty-row">
              <span className="work-duty-bullet"><Icon name="check-circle" /></span>
              <div className="work-obl-main">
                <span className="work-obl-title">{o.title}</span>
                {o.note && <span className="work-obl-note">{o.note}</span>}
              </div>
              <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => del(o.id)} aria-label={t('common.delete')}><Icon name="trash" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
