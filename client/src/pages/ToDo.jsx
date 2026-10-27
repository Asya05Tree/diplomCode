import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { addTodo, getTodos, moveTodo, removeTodo } from '../api/todo'
import Icon from '../components/Icon'
import './ToDo.css'

// Дошка задач "To-Do" — три "листки" (Зробити / В процесі / Зроблено). Картку
// додають у перший листок, а далі рухають стрілками між листками. Дані — з бекенда
// (/api/todo): кожна картка має status (todo|doing|done) і orderIndex усередині колонки.
const COLUMNS = [
  { status: 'todo', icon: 'list' },
  { status: 'doing', icon: 'wrench' },
  { status: 'done', icon: 'check-circle' },
]

export default function ToDo() {
  const { t } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState('')

  useEffect(() => {
    let cancelled = false
    getTodos()
      .then((list) => {
        if (cancelled) return
        setItems(list)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const reload = async () => setItems(await getTodos())

  const handleAdd = async (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await addTodo(text)
    await reload()
  }

  // Рух між листками: цільовий статус — сусідня колонка, orderIndex — у кінець цієї колонки.
  const handleMove = async (item, colIdx, dir) => {
    const target = COLUMNS[colIdx + dir]
    if (!target) return
    const orderIndex = items.filter((x) => x.status === target.status).length
    await moveTodo(item.id, target.status, orderIndex)
    await reload()
  }

  const handleDelete = async (id) => {
    await removeTodo(id)
    await reload()
  }

  if (loading) {
    return (
      <div className="todo-page">
        <p className="placeholder-text">{t('common.loading')}</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="todo-page">
        <p className="placeholder-text">{t('common.error')}</p>
      </div>
    )
  }

  return (
    <div className="todo-page">
      <div className="page-head">
        <h2>{t('nav.todo')}</h2>
        <span className="variant-note">{t('todo.note')}</span>
      </div>

      <form className="todo-add" onSubmit={handleAdd}>
        <input
          type="text"
          value={draft}
          placeholder={t('todo.addPlaceholder')}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn-accent">{t('todo.addButton')}</button>
      </form>

      <div className="todo-board">
        {COLUMNS.map((col, colIdx) => {
          const colItems = items
            .filter((item) => item.status === col.status)
            .sort((a, b) => a.orderIndex - b.orderIndex)
          return (
            <div key={col.status} className={`todo-col todo-col--${col.status}`}>
              <div className="todo-col-head">
                <span className="todo-col-title">
                  <Icon name={col.icon} className="todo-col-icon" />
                  {t(`todo.col.${col.status}`)}
                </span>
                <span className="todo-col-count">{colItems.length}</span>
              </div>

              {colItems.length === 0 && <p className="todo-col-empty">{t('todo.empty')}</p>}

              {colItems.map((item) => (
                <div key={item.id} className="todo-card anim-fade-in-up">
                  <span className="todo-card-text">{item.text}</span>
                  <div className="todo-card-actions">
                    <button
                      type="button"
                      className="todo-card-btn"
                      disabled={colIdx === 0}
                      aria-label={t('todo.moveLeft')}
                      data-tooltip={t('todo.moveLeft')}
                      onClick={() => handleMove(item, colIdx, -1)}
                    >
                      <Icon name="chevron-left" />
                    </button>
                    <button
                      type="button"
                      className="todo-card-btn"
                      disabled={colIdx === COLUMNS.length - 1}
                      aria-label={t('todo.moveRight')}
                      data-tooltip={t('todo.moveRight')}
                      onClick={() => handleMove(item, colIdx, 1)}
                    >
                      <Icon name="chevron-right" />
                    </button>
                    <button
                      type="button"
                      className="todo-card-btn todo-card-btn--danger"
                      aria-label={t('todo.delete')}
                      data-tooltip={t('todo.delete')}
                      onClick={() => handleDelete(item.id)}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
