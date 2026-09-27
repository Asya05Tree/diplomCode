import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n'
import { getUnassignedCount } from '../api/tasks'
import './Sidebar.css'

const AUTH_TOKEN_KEY = 'authToken'

// Пункти й кольори модулів (planner-spec.md §4.1, coding-guide.md §5).
// Пізніше список фільтрується по UserModule.IsEnabled — вимкнений модуль тут не з'являється.
// Статистика без окремої вкладки — показується всередині відповідних розділів (Їжа, Фінанси тощо).
// Реальні розділи цієї ітерації — Календар і Нерозподілені (§4.2-4.5); решта — заглушки на потім.
const NAV_ITEMS = [
  { key: 'nav.calendar', icon: '📅', color: 'var(--color-tasks)', to: '/app' },
  { key: 'nav.unassigned', icon: '📋', color: 'var(--color-tasks)', to: '/app/unassigned' },
  { key: 'nav.food', icon: '🍲', color: 'var(--color-food)' },
  { key: 'nav.health', icon: '💊', color: 'var(--color-health)' },
  { key: 'nav.finance', icon: '💰', color: 'var(--color-finance)' },
  { key: 'nav.study', icon: '🎓', color: 'var(--color-study)' },
  { key: 'nav.cycle', icon: '🌸', color: 'var(--color-cycle)' },
  { key: 'nav.notes', icon: '📝', color: 'var(--color-notes)' },
  { key: 'nav.settings', icon: '⚙️', color: 'var(--color-tasks)' },
]

export default function Sidebar() {
  const { t } = useI18n()
  const location = useLocation()
  const [unassignedCount, setUnassignedCount] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) return
    getUnassignedCount(token)
      .then((res) => setUnassignedCount(res.count))
      .catch(() => {})
  }, [location.pathname])

  return (
    <nav className="sidebar">
      {NAV_ITEMS.map((item) => {
        const label = item.key === 'nav.unassigned' && unassignedCount > 0
          ? `${t(item.key)} (${unassignedCount})`
          : t(item.key)

        if (!item.to) {
          return (
            <div key={item.key} className="sidebar-item" style={{ '--item-color': item.color }}>
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{label}</span>
            </div>
          )
        }

        return (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) =>
              isActive ? 'sidebar-item sidebar-item--active' : 'sidebar-item'
            }
            style={{ '--item-color': item.color }}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
