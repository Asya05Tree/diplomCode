import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import QuickAdd from '../components/planner/QuickAdd'
import { getSubjects } from '../api/study'
import { getFoodOverview } from '../api/food'
import './QuickAddPage.css'

const AUTH_TOKEN_KEY = 'authToken'

// Окрема сторінка швидкого додавання задач із природномовного рядка (перший пункт меню).
// Самі задачі не створюються автоматично — лише після підтвердження на екрані розбору.
// Для задач модуля "Навчання" підвантажуємо наявні предмети (зіставлення/створення).
export default function QuickAddPage() {
  const { studentType } = useOutletContext() ?? {}
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const canAddSubjects = studentType === 'pupil' || studentType === 'student'

  const [subjects, setSubjects] = useState([])
  // Довідник продуктів + запаси + рецепти — для "додати до запасів", перевірки наявності та
  // прив'язки страви ("приготувати борщ" → рецепт).
  const [food, setFood] = useState({ products: [], stock: {}, recipes: [] })

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
        setFood({ products: o.products || [], stock, recipes: o.recipes || [] })
      })
      .catch(() => { if (!cancelled) setFood({ products: [], stock: {}, recipes: [] }) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="quick-add-page">
      <QuickAdd token={token} subjects={subjects} canAddSubjects={canAddSubjects} products={food.products} stock={food.stock} recipes={food.recipes} />
    </div>
  )
}
