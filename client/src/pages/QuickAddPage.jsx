import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useI18n } from '../i18n'
import QuickAdd from '../components/planner/QuickAdd'
import { getSubjects } from '../api/study'
import { getFoodOverview } from '../api/food'
import './QuickAddPage.css'

const AUTH_TOKEN_KEY = 'authToken'

// Окрема сторінка швидкого додавання задач із природномовного рядка (перший пункт меню).
// Самі задачі не створюються автоматично — лише після підтвердження на екрані розбору.
// Для задач модуля "Навчання" підвантажуємо наявні предмети (зіставлення/створення).
export default function QuickAddPage() {
  const { t } = useI18n()
  const { studentType } = useOutletContext() ?? {}
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const canAddSubjects = studentType === 'pupil' || studentType === 'student'

  const [subjects, setSubjects] = useState([])
  // Довідник продуктів + поточні запаси — для розпізнавання "додати до запасів" і перевірки наявності.
  const [food, setFood] = useState({ products: [], stock: {} })

  useEffect(() => {
    if (!canAddSubjects) { setSubjects([]); return }
    let cancelled = false
    getSubjects()
      .then((list) => { if (!cancelled) setSubjects(list || []) })
      .catch(() => { if (!cancelled) setSubjects([]) })
    return () => { cancelled = true }
  }, [canAddSubjects])

  useEffect(() => {
    let cancelled = false
    getFoodOverview()
      .then((o) => {
        if (cancelled) return
        const stock = {}
        for (const s of o.stock || []) stock[s.productId] = s.state
        setFood({ products: o.products || [], stock })
      })
      .catch(() => { if (!cancelled) setFood({ products: [], stock: {} }) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="quick-add-page">
      <div className="page-head">
        <h2>{t('nav.quickAdd')}</h2>
      </div>
      <QuickAdd token={token} subjects={subjects} canAddSubjects={canAddSubjects} products={food.products} stock={food.stock} />
    </div>
  )
}
