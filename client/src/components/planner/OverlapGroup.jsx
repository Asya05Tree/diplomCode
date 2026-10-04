import { useState } from 'react'
import { useI18n } from '../../i18n'
import { formatTime, fromApiDateTime } from '../../utils/date'
import './OverlapGroup.css'

// Кілька задач на точно один час (§4.4) — замість плоского списку з позначкою "накладається"
// згортаємо їх в один рядок, що розгортається кліком.
export default function OverlapGroup({ tasks, renderItem }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const time = tasks[0].startDateTime ? formatTime(fromApiDateTime(tasks[0].startDateTime)) : '—'

  return (
    <div className="overlap-group">
      <button type="button" className="overlap-group-summary" onClick={() => setOpen((o) => !o)}>
        <span className="task-item-time">{time}</span>
        <span className="overlap-group-count">⚠ {t('planner.overlapBadge')} · {t('planner.overlapCount', { count: tasks.length })}</span>
        <span className="overlap-group-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="overlap-group-list">{tasks.map((task) => renderItem(task))}</div>}
    </div>
  )
}
