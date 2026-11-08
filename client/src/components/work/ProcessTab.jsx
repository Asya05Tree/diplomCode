import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import FieldHelp from '../FieldHelp'
import { getProcessTasks, addProcessTask, updateProcessTask, removeProcessTask } from '../../api/work'
import { PROCESS_STATUSES } from './workShared'
import { todayApiDate } from '../../utils/date'

// Планування процесу — to-do зі станами "Планую / Роблю / Зроблено". Замість трьох колонок поруч —
// вкладки (планую/роблю/зроблено + окрема "Борги" з простроченими). Дедлайн виноситься в головний
// календар (moduleCode="work"). "Прострочено" — похідний стан (дедлайн минув, а задача не зроблена);
// такі задачі також потрапляють у "Важливі борги" головного календаря.
export default function ProcessTab() {
  const { t, formatDate } = useI18n()
  const [items, setItems] = useState([])
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [activeTab, setActiveTab] = useState('planned')
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
    setActiveTab('planned')
    await reload()
  }

  // Перемістити задачу в сусідній стан (← назад / → далі по статусах).
  const move = async (task, dir) => {
    const idx = PROCESS_STATUSES.indexOf(task.status)
    const next = PROCESS_STATUSES[idx + dir]
    if (!next) return
    await updateProcessTask(task.id, { title: task.title, note: task.note, status: next, dueDate: task.dueDate })
    await reload()
  }

  const del = async (id) => { await removeProcessTask(id); await reload() }

  const isOverdue = (task) => task.dueDate && task.dueDate < today && task.status !== 'done'

  const byStatus = useMemo(() => {
    const map = { planned: [], doing: [], done: [] }
    for (const it of items) (map[it.status] ?? map.planned).push(it)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const overdueList = useMemo(() => items.filter(isOverdue), [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const TABS = [
    ...PROCESS_STATUSES.map((s) => ({ key: s, label: t(`work.process.${s}`), count: byStatus[s].length })),
    { key: 'overdue', label: t('work.processDebts'), count: overdueList.length, debt: true },
  ]
  const activeList = activeTab === 'overdue' ? overdueList : byStatus[activeTab]

  const renderCard = (task) => {
    const overdue = isOverdue(task)
    const idx = PROCESS_STATUSES.indexOf(task.status)
    return (
      <div key={task.id} className={overdue ? 'work-kanban-card work-kanban-card--overdue' : 'work-kanban-card'}>
        <div className="work-kanban-card-title">{task.title}</div>
        {task.note && <div className="work-kanban-card-note">{task.note}</div>}
        <div className="work-kanban-card-due">
          {/* У вкладці "Борги" показуємо, в якому стані задача; інакше — дату дедлайну */}
          {activeTab === 'overdue' && <span className="work-kind-badge">{t(`work.process.${task.status}`)}</span>}
          {task.dueDate && (<><Icon name="calendar" />{formatDate(task.dueDate)}</>)}
          {overdue && <span className="work-kanban-overdue">{t('work.process.overdue')}</span>}
        </div>
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
  }

  return (
    <div className="card">
      <form className="work-form work-inline-form" onSubmit={submit}>
        <label className="work-form-grow"><span className="work-label-head">{t('work.processTaskTitle')}<FieldHelp text={t('work.processTaskTitleHelp')} label={t('fieldHelp.label')} /></span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('work.processPlaceholder')} /></label>
        <label className="work-form-grow"><span className="work-label-head">{t('work.obligationNote')} <span className="work-optional">({t('work.optional')})</span></span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <label><span className="work-label-head">{t('work.processDue')} <span className="work-optional">({t('work.optional')})</span><FieldHelp text={t('work.processDueHelp')} label={t('fieldHelp.label')} /></span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <button type="submit" className="btn-accent">{t('work.addProcessTask')}</button>
      </form>

      <div className="work-pills work-process-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`work-pill${activeTab === tab.key ? ' work-pill--active' : ''}${tab.debt && tab.count > 0 ? ' work-pill--debt' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}<span className="work-process-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {activeList.length === 0 ? (
        <p className="work-process-empty">{activeTab === 'overdue' ? t('work.processNoDebts') : t('work.processEmptyCol')}</p>
      ) : (
        <div className="work-process-list">
          {activeList.map(renderCard)}
        </div>
      )}
    </div>
  )
}
