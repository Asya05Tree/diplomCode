import { NavLink } from 'react-router-dom'
import { useI18n } from '../i18n'
import Icon from './Icon'
import './Sidebar.css'

// Пункти й кольори модулів (planner-spec.md §4.1, coding-guide.md §5).
// Пізніше список фільтрується по UserModule.IsEnabled — вимкнений модуль тут не з'являється.
// Іконки — Heroicons (Icon.jsx), колір модуля лишається смужкою зліва + відтінком іконки.
const NAV_ITEMS = [
  { key: 'nav.calendar', icon: 'calendar-days', color: 'var(--color-tasks)', to: '/app' },
  { key: 'nav.todo', icon: 'board', color: 'var(--color-todo)', to: '/app/todo' },
  { key: 'nav.shoppingList', icon: 'cart', color: 'var(--color-food)', to: '/app/shopping-list' },
  { key: 'nav.food', icon: 'cake', color: 'var(--color-food)', to: '/app/food' },
  { key: 'nav.health', icon: 'health', color: 'var(--color-health)', to: '/app/health' },
  { key: 'nav.finance', icon: 'finance', color: 'var(--color-finance)', to: '/app/finance' },
  { key: 'nav.study', icon: 'study', color: 'var(--color-study)', to: '/app/study' },
  { key: 'nav.work', icon: 'work', color: 'var(--color-work)' },
  { key: 'nav.cycle', icon: 'cycle', color: 'var(--color-cycle)', to: '/app/cycle' },
  { key: 'nav.notes', icon: 'notes', color: 'var(--color-notes)' },
  { key: 'nav.settings', icon: 'settings', color: 'var(--color-tasks)', to: '/app/settings' },
]

export default function Sidebar() {
  const { t } = useI18n()

  return (
    <nav className="sidebar">
      <NavLink to="/app" end className="sidebar-brand" data-tooltip-pos="bottom" data-tooltip="Всетута">
        <img src="/images/logo1.png" alt="" className="sidebar-brand-logo" />
        <span className="sidebar-brand-name">Всетута</span>
      </NavLink>

      <div className="sidebar-items">
        {NAV_ITEMS.map((item) => {
          const label = t(item.key)

          if (!item.to) {
            return (
              <div
                key={item.key}
                className="sidebar-item sidebar-item--disabled"
                style={{ '--item-color': item.color }}
                data-tooltip="Скоро"
                data-tooltip-pos="right"
              >
                <Icon name={item.icon} className="sidebar-icon" />
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
              <Icon name={item.icon} className="sidebar-icon" />
              <span className="sidebar-label">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
