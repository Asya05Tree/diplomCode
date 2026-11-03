import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useI18n } from '../i18n'
import QuickAdd from '../components/planner/QuickAdd'
import { getSubjects } from '../api/study'
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

  useEffect(() => {
    if (!canAddSubjects) { setSubjects([]); return }
    let cancelled = false
    getSubjects()
      .then((list) => { if (!cancelled) setSubjects(list || []) })
      .catch(() => { if (!cancelled) setSubjects([]) })
    return () => { cancelled = true }
  }, [canAddSubjects])

  return (
    <div className="quick-add-page">
      <div className="page-head">
        <h2>{t('nav.quickAdd')}</h2>
      </div>
      <QuickAdd token={token} subjects={subjects} canAddSubjects={canAddSubjects} />
    </div>
  )
}
