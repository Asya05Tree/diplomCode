import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getProcessTasks, addProcessTask, updateProcessTask, removeProcessTask } from '../../api/work'
import { PROCESS_STATUSES } from './workShared'
import { todayApiDate } from '../../utils/date'

// Планування процесу — to-do з колонками "Планую / Роблю / Зроблено". Дедлайн виноситься в головний
// календар (moduleCode="work"). "Прострочено" — похідний стан (дедлайн минув, а задача не зроблена),
// показується як бейдж на картці; такі задачі також потрапляють у "Важливі борги" головного календаря.
export default function ProcessTab() {
  const { t, formatDate } = useI18n()
  const [items, setItems] = useState([])
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [dueDate, setDueDate] = useState('')
  const today = todayApiDate()

  const reload = () => getProcessTasks().then(setItems).catch(() => setItems([]))
  useEffect(() => { reload() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await addProcessTask({ title: title.trim(), note: note.trim() || null, status: 'planned', dueDate: dueDate || null })
    setTitle('')
    setNote('')
    setDueDate('')
    await reload()
  }

  // Перемістити задачу в сусідню колонку (← назад / → далі по статусах).
  const move = async (task, dir) => {
    const idx = PROCESS_STATUSES.indexOf(task.status)
    const next = PROCESS_STATUSES[idx + dir]
    if (!next) return
    await updateProcessTask(task.id, { title: task.title, note: task.note, status: next, dueDate: task.dueDate })
    await reload()
  }

  const del = async (id) => { await removeProcessTask(id); await reload() }

  const byStatus = useMemo(() => {
    const map = { planned: [], doing: [], done: [] }
    for (const it of items) (map[it.status] ?? map.planned).push(it)
    return map
  }, [items])

  const isOverdue = (task) => task.dueDate && task.dueDate < today && task.status !== 'done'

  return (
    <div className="card">
      <div className="work-section-head"><h3>{t('work.processTitle')}</h3></div>
      <p className="work-regime-hint">{t('work.processHint')}</p>

      <form className="work-form work-inline-form" onSubmit={submit}>
        <label className="work-form-grow">{t('work.processTaskTitle')}<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('work.processPlaceholder')} /></label>
        <label className="work-form-grow"><span className="work-label-head">{t('work.obligationNote')} <span className="work-optional">({t('work.optional')})</span></span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <label><span className="work-label-head">{t('work.processDue')} <span className="work-optional">({t('work.optional')})</span></span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <button type="submit" className="btn-accent">{t('work.addProcessTask')}</button>
      </form>

      <div className="work-kanban">
        {PROCESS_STATUSES.map((status) => (
          <div key={status} className={`work-kanban-col work-kanban-col--${status}`}>
            <div className="work-kanban-head">
              <span>{t(`work.process.${status}`)}</span>
              <span className="work-kanban-count">{byStatus[status].length}</span>
            </div>
            <div className="work-kanban-cards">
              {byStatus[status].length === 0 ? (
                <p className="work-kanban-empty">{t('work.processEmptyCol')}</p>
              ) : (
                byStatus[status].map((task) => {
                  const overdue = isOverdue(task)
                  const idx = PROCESS_STATUSES.indexOf(task.status)
                  return (
                    <div key={task.id} className={overdue ? 'work-kanban-card work-kanban-card--overdue' : 'work-kanban-card'}>
                      <div className="work-kanban-card-title">{task.title}</div>
                      {task.note && <div className="work-kanban-card-note">{task.note}</div>}
                      {task.dueDate && (
                        <div className="work-kanban-card-due">
                          <Icon name="calendar" />{formatDate(task.dueDate)}
                          {overdue && <span className="work-kanban-overdue">{t('work.process.overdue')}</span>}
                        </div>
                      )}
                      <div className="work-kanban-card-actions">
                        <button type="button" className="work-icon-btn" disabled={idx === 0} onClick={() => move(task, -1)} aria-label={t('work.processMoveBack')} data-tooltip={t('work.processMoveBack')}>
                          <Icon name="chevron-left" />
                        </button>
                        <button type="button" className="work-icon-btn" disabled={idx === PROCESS_STATUSES.length - 1} onClick={() => move(task, 1)} aria-label={t('work.processMoveFwd')} data-tooltip={t('work.processMoveFwd')}>
                          <Icon name="chevron-right" />
                        </button>
                        <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => del(task.id)} aria-label={t('common.delete')}>
                          <Icon name="trash" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
