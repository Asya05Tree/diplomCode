import { useI18n } from '../i18n'
import QuickAdd from '../components/planner/QuickAdd'
import './QuickAddPage.css'

const AUTH_TOKEN_KEY = 'authToken'

// Окрема сторінка швидкого додавання задач із природномовного рядка (перший пункт меню).
// Самі задачі не створюються автоматично — лише після підтвердження на екрані розбору.
export default function QuickAddPage() {
  const { t } = useI18n()
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  return (
    <div className="quick-add-page">
      <div className="page-head">
        <h2>{t('nav.quickAdd')}</h2>
      </div>
      <QuickAdd token={token} />
    </div>
  )
}
