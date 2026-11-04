import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getAssignments, updateAssignment } from '../../api/study'
import { todayApiDate } from '../../utils/date'

// Борги з навчання — невиконані завдання. Дві під-вкладки:
//   • "Борги" — усі невиконані завдання (незалежно від дедлайну);
//   • "Прострочені" — невиконані, чий дедлайн уже минув (важливі борги, що видно й у головному календарі).
export default function DebtsTab() {
  const { t } = useI18n()
  const [items, setItems] = useState([])
  const [view, setView] = useState('overdue') // 'overdue' | 'all'
  const today = todayApiDate()

  const reload = async () => setItems(await getAssignments())
  useEffect(() => { reload() }, [])

  const unfinished = useMemo(() => items.filter((a) => !a.isDone), [items])
  const overdue = useMemo(
    () => unfinished.filter((a) => a.resolvedDeadline && a.resolvedDeadline < today),
    [unfinished, today],
  )
  const list = view === 'overdue' ? overdue : unfinished

  const markDone = async (a) => {
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, isDone: true } : x)))
    await updateAssignment(a.id, {
      subjectId: a.subjectId ?? null,
      type: a.type,
      description: a.description,
      deadlineKind: a.deadlineKind,
      dueDate: a.deadlineKind === 'date' ? a.dueDate : null,
      isDone: true,
      grade: null,
    })
  }

  return (
    <div className="card">
      <div className="study-seg study-seg--inline">
        {[['overdue', overdue.length], ['all', unfinished.length]].map(([key, count]) => (
          <button
            key={key}
            type="button"
            className={view === key ? 'study-seg-btn study-seg-btn--active' : 'study-seg-btn'}
            onClick={() => setView(key)}
          >
            {t(`study.debts.${key}`)} ({count})
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="placeholder-text">{t('study.debts.empty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('study.col.type')}</th>
                <th>{t('study.col.task')}</th>
                <th>{t('study.col.subject')}</th>
                <th>{t('study.col.deadline')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const isOverdue = a.resolvedDeadline && a.resolvedDeadline < today
                return (
                  <tr key={a.id} className={isOverdue ? 'study-debt-row--overdue' : undefined}>
                    <td>{t(`study.type.${a.type}`)}</td>
                    <td className="study-desc-cell">{a.description}</td>
                    <td>{a.subjectName || <span className="none-text">—</span>}</td>
                    <td>
                      {a.resolvedDeadline || <span className="none-text">—</span>}
                      {isOverdue && <span className="badge badge--bad study-debt-badge">{t('study.debts.overdueBadge')}</span>}
                    </td>
                    <td className="study-row-actions">
                      <button
                        type="button"
                        className="study-icon-btn"
                        onClick={() => markDone(a)}
                        aria-label={t('study.debts.markDone')}
                        data-tooltip={t('study.debts.markDone')}
                      >
                        <Icon name="check-circle" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
