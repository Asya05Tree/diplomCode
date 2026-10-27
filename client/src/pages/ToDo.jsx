import { useState } from 'react'
import { useI18n } from '../i18n'
import { addTodo, deleteTodo, getTodos, moveTodo } from '../utils/todo'
import Icon from '../components/Icon'
import './ToDo.css'

// Дошка задач "To-Do" — три "листки" (Зробити / В процесі / Зроблено). Картку
// додають у перший листок, а далі рухають стрілками між листками. Дані — у
// localStorage (utils/todo.js), поки без бекенду.
const COLUMNS = [
  { status: 'todo', icon: 'list' },
  { status: 'doing', icon: 'wrench' },
  { status: 'done', icon: 'check-circle' },
]

export default function ToDo() {
  const { t } = useI18n()
  const [items, setItems] = useState(() => getTodos())
  const [draft, setDraft] = useState('')

  const handleAdd = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    setItems(addTodo(draft))
    setDraft('')
  }

  const handleMove = (id, dir) => setItems(moveTodo(id, dir))
  const handleDelete = (id) => setItems(deleteTodo(id))

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
          const colItems = items.filter((item) => item.status === col.status)
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
                      onClick={() => handleMove(item.id, -1)}
                    >
                      <Icon name="chevron-left" />
                    </button>
                    <button
                      type="button"
                      className="todo-card-btn"
                      disabled={colIdx === COLUMNS.length - 1}
                      aria-label={t('todo.moveRight')}
                      data-tooltip={t('todo.moveRight')}
                      onClick={() => handleMove(item.id, 1)}
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
