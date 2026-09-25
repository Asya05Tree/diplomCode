import { useI18n } from '../i18n'
import './Sidebar.css'

// Пункти й кольори модулів (planner-spec.md §4.1, coding-guide.md §5).
// Пізніше список фільтрується по UserModule.IsEnabled — вимкнений модуль тут не з'являється.
// Статистика без окремої вкладки — показується всередині відповідних розділів (Їжа, Фінанси тощо).
const NAV_ITEMS = [
  { key: 'nav.calendar', icon: '📅', color: 'var(--color-tasks)' },
  { key: 'nav.unassigned', icon: '📋', color: 'var(--color-tasks)' },
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

  return (
    <nav className="sidebar">
      {NAV_ITEMS.map((item) => (
        <div key={item.key} className="sidebar-item" style={{ '--item-color': item.color }}>
          <span className="sidebar-icon">{item.icon}</span>
          <span className="sidebar-label">{t(item.key)}</span>
        </div>
      ))}
    </nav>
  )
}
