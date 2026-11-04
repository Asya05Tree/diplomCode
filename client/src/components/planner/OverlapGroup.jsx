import { useState } from 'react'
import { useI18n } from '../../i18n'
import { fromApiDateTime } from '../../utils/date'
import Icon from '../Icon'
import './OverlapGroup.css'

// Кілька задач, чиї проміжки накладаються (§4.4) — замість плоского списку з позначкою
// "накладається" згортаємо їх в один рядок, що розгортається кліком. Задачі можуть мати
// різний час початку, тож заголовок показує діапазон кластера: найраніший початок – найпізніший кінець.
export default function OverlapGroup({ tasks, renderItem }) {
  const { t, formatTime } = useI18n()
  const [open, setOpen] = useState(false)

  const starts = tasks.filter((x) => x.startDateTime).map((x) => fromApiDateTime(x.startDateTime).getTime())
  const ends = tasks
    .filter((x) => x.startDateTime)
    .map((x) => fromApiDateTime(x.startDateTime).getTime() + (x.durationMinutes ? x.durationMinutes * 60000 : 0))
  let time = '—'
  if (starts.length) {
    const minStart = formatTime(new Date(Math.min(...starts)))
    const maxEnd = Math.max(...ends)
    time = maxEnd > Math.min(...starts) ? `${minStart} – ${formatTime(new Date(maxEnd))}` : minStart
  }

  return (
    <div className="overlap-group">
      <button type="button" className="overlap-group-summary" onClick={() => setOpen((o) => !o)}>
        <span className="task-item-time">{time}</span>
        <span className="overlap-group-count">
          <Icon name="warning" />
          {t('planner.overlapBadge')} · {t('planner.overlapCount', { count: tasks.length })}
        </span>
        <Icon
          name="chevron-right"
          className={open ? 'overlap-group-chevron overlap-group-chevron--open' : 'overlap-group-chevron'}
        />
      </button>
      {open && <div className="overlap-group-list">{tasks.map((task) => renderItem(task))}</div>}
    </div>
  )
}
