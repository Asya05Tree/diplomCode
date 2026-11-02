import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import { addMedia, deleteMedia, getMedia, scheduleMedia, setMediaStatus, updateMedia } from '../api/media'
import { MAX_LEN, filterWords, limitText } from '../utils/validation'
import { toApiDateTime, todayApiDate } from '../utils/date'
import './Watchlist.css'

// Список "що подивитися / що прочитати": дві під-вкладки (Відео / Книги), кожна — дошка
// з трьох колонок planned → in_progress → done. Статус рухається тільки вперед (назад у
// "В планах" не можна); "Завершено" лишається записом із відгуком і не видаляється саме собою.
const KINDS = [
  { key: 'video', icon: 'film' },
  { key: 'book', icon: 'book-open' },
]
const COLUMNS = [
  { status: 'planned', icon: 'list' },
  { status: 'in_progress', icon: 'wrench' },
  { status: 'done', icon: 'check-circle' },
]

// Клікабельні зірки 1..5 (для книг у "Завершено"). readOnly — лише показ.
function Stars({ value = 0, onChange, readOnly = false }) {
  return (
    <div className={readOnly ? 'watch-stars watch-stars--ro' : 'watch-stars'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? 'watch-star watch-star--on' : 'watch-star'}
          disabled={readOnly}
          aria-label={`${n}`}
          onClick={readOnly ? undefined : () => onChange(n === value ? 0 : n)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function Watchlist() {
  const { t } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [items, setItems] = useState([])
  const [kind, setKind] = useState('video')

  // Чернетки форми додавання (в колонці "В планах")
  const [draftTitle, setDraftTitle] = useState('')
  const [draftAuthor, setDraftAuthor] = useState('')

  // Поповер планування: { id, date, time }
  const [sched, setSched] = useState(null)
  // Локальне редагування відгуку/рейтингу в "Завершено": { [id]: { rating, review } }
  const [edits, setEdits] = useState({})

  useEffect(() => {
    let cancelled = false
    getMedia()
      .then((list) => {
        if (cancelled) return
        setItems(list || [])
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

  const reload = async () => setItems((await getMedia()) || [])

  const handleAdd = async (e) => {
    e.preventDefault()
    const title = draftTitle.trim()
    if (!title) return
    setDraftTitle('')
    setDraftAuthor('')
    await addMedia({ kind, title, author: kind === 'book' ? draftAuthor.trim() : null })
    await reload()
  }

  const openSchedule = (item) => setSched({ id: item.id, date: todayApiDate(), time: '12:00' })

  const submitSchedule = async () => {
    if (!sched) return
    const [y, m, d] = sched.date.split('-').map(Number)
    const [h, min] = sched.time.split(':').map(Number)
    const startDateTime = toApiDateTime(new Date(y, m - 1, d, h, min))
    const id = sched.id
    setSched(null)
    await scheduleMedia(id, { startDateTime, durationMinutes: null })
    await reload()
  }

  const handleFinish = async (item) => {
    await setMediaStatus(item.id, { status: 'done' })
    await reload()
  }

  const getEdit = (item) => edits[item.id] ?? { rating: item.ratingStars || 0, review: item.review || '' }
  const setEdit = (item, patch) =>
    setEdits((prev) => ({ ...prev, [item.id]: { ...getEdit(item), ...patch } }))

  const handleSaveDone = async (item) => {
    const { rating, review } = getEdit(item)
    await updateMedia(item.id, {
      title: item.title,
      author: item.author,
      ratingStars: item.kind === 'book' ? rating || null : null,
      review: review || null,
    })
    setEdits((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    await reload()
  }

  const handleDelete = async (id) => {
    await deleteMedia(id)
    await reload()
  }

  if (loading) {
    return (
      <div className="watch-page">
        <p className="placeholder-text">{t('common.loading')}</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="watch-page">
        <p className="placeholder-text">{t('common.error')}</p>
      </div>
    )
  }

  const visible = items.filter((it) => it.kind === kind)

  return (
    <div className="watch-page">
      <div className="page-head">
        <h2>{t('nav.watchlist')}</h2>
        <span className="variant-note">{t('watchlist.note')}</span>
      </div>

      {/* Під-вкладки Відео / Книги */}
      <div className="watch-kinds">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            className={kind === k.key ? 'watch-kind watch-kind--active' : 'watch-kind'}
            onClick={() => setKind(k.key)}
          >
            <Icon name={k.icon} className="watch-kind-icon" />
            {t(`watchlist.kind.${k.key}`)}
          </button>
        ))}
      </div>

      <div className="watch-board">
        {COLUMNS.map((col) => {
          const colItems = visible.filter((it) => it.status === col.status)
          return (
            <div key={col.status} className={`watch-col watch-col--${col.status}`}>
              <div className="watch-col-head">
                <span className="watch-col-title">
                  <Icon name={col.icon} className="watch-col-icon" />
                  {t(`watchlist.col.${col.status}`)}
                </span>
                <span className="watch-col-count">{colItems.length}</span>
              </div>

              {/* Форма додавання — тільки в колонці "В планах" */}
              {col.status === 'planned' && (
                <form className="watch-add" onSubmit={handleAdd}>
                  <input
                    type="text"
                    value={draftTitle}
                    placeholder={t(`watchlist.addTitle.${kind}`)}
                    maxLength={MAX_LEN.title}
                    onChange={(e) => setDraftTitle(limitText(e.target.value, MAX_LEN.title))}
                  />
                  {kind === 'book' && (
                    <input
                      type="text"
                      value={draftAuthor}
                      placeholder={t('watchlist.addAuthor')}
                      maxLength={MAX_LEN.name}
                      onChange={(e) => setDraftAuthor(filterWords(e.target.value, MAX_LEN.name))}
                    />
                  )}
                  <button type="submit" className="btn-accent">{t('watchlist.add')}</button>
                </form>
              )}

              {colItems.length === 0 && <p className="watch-col-empty">{t('watchlist.empty')}</p>}

              {colItems.map((item) => {
                const edit = getEdit(item)
                return (
                  <div key={item.id} className="watch-card anim-fade-in-up">
                    <span className="watch-card-title">{item.title}</span>
                    {item.author && <span className="watch-card-author">{item.author}</span>}

                    {item.startDate && (
                      <Link to="/app" className="watch-card-when">
                        <Icon name="calendar" className="watch-when-icon" />
                        {new Date(item.startDate).toLocaleDateString()}
                      </Link>
                    )}

                    {/* "Завершено": рейтинг (книги) + відгук, із збереженням */}
                    {item.status === 'done' && (
                      <div className="watch-done-review">
                        {item.kind === 'book' && (
                          <Stars value={edit.rating} onChange={(r) => setEdit(item, { rating: r })} />
                        )}
                        <textarea
                          rows={2}
                          value={edit.review}
                          placeholder={t('watchlist.reviewPlaceholder')}
                          maxLength={MAX_LEN.description}
                          onChange={(e) => setEdit(item, { review: limitText(e.target.value, MAX_LEN.description) })}
                        />
                        <button type="button" className="watch-btn-save" onClick={() => handleSaveDone(item)}>
                          {t('watchlist.saveReview')}
                        </button>
                      </div>
                    )}

                    {/* Поповер планування (в "В планах") */}
                    {sched?.id === item.id ? (
                      <div className="watch-sched">
                        <input
                          type="date"
                          value={sched.date}
                          min={todayApiDate()}
                          onChange={(e) => setSched((s) => ({ ...s, date: e.target.value }))}
                        />
                        <input
                          type="time"
                          value={sched.time}
                          onChange={(e) => setSched((s) => ({ ...s, time: e.target.value }))}
                        />
                        <div className="watch-sched-actions">
                          <button type="button" className="watch-btn-save" onClick={submitSchedule}>
                            {t('watchlist.scheduleConfirm')}
                          </button>
                          <button type="button" className="watch-btn-ghost" onClick={() => setSched(null)}>
                            {t('watchlist.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="watch-card-actions">
                        {item.status === 'planned' && (
                          <button
                            type="button"
                            className="watch-btn-ghost"
                            onClick={() => openSchedule(item)}
                          >
                            {t('watchlist.schedule')}
                          </button>
                        )}
                        {item.status !== 'done' && (
                          <button
                            type="button"
                            className="watch-btn-ghost"
                            onClick={() => handleFinish(item)}
                          >
                            {t('watchlist.finish')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="watch-card-btn watch-card-btn--danger"
                          aria-label={t('watchlist.delete')}
                          data-tooltip={t('watchlist.delete')}
                          onClick={() => handleDelete(item.id)}
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
