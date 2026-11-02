import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import { addMedia, deleteMedia, getMedia, scheduleMedia, setMediaStatus, updateMedia } from '../api/media'
import { genresFor, genreName, typeName, VIDEO_TYPES } from '../utils/watchlistTaxonomy'
import { MAX_LEN, filterWords, limitText } from '../utils/validation'
import { toApiDateTime, todayApiDate } from '../utils/date'
import './Watchlist.css'

// Список "що подивитися / що прочитати": під-вкладки (Відео / Книги) × вкладки статусу
// (У планах / У процесі / Завершено). Усередині — сітка карток (стиль меню їжі). Пошук за
// назвою + фільтр (жанр для книг; жанр + вид для відео). Статус рухається тільки вперед.
const KINDS = [
  { key: 'video', icon: 'film' },
  { key: 'book', icon: 'book-open' },
]
const STATUSES = [
  { key: 'planned', icon: 'list' },
  { key: 'in_progress', icon: 'wrench' },
  { key: 'done', icon: 'check-circle' },
]

const emptyDraft = { title: '', author: '', genre: '', type: '' }

// Клікабельні зірки 1..5 (для відео й книг у "Завершено"). readOnly — лише показ.
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
  const { t, language } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [items, setItems] = useState([])

  const [kind, setKind] = useState('video')
  const [status, setStatus] = useState('planned')
  const [search, setSearch] = useState('')
  const [genreFilter, setGenreFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const [draft, setDraft] = useState(emptyDraft)
  const [sched, setSched] = useState(null) // { id, date, time, genre, type }
  const [edits, setEdits] = useState({}) // { [id]: { rating, review } }

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

  // Зміна типу скидає фільтри й чернетку (жанри в книг/відео різні)
  const switchKind = (k) => {
    setKind(k)
    setGenreFilter('all')
    setTypeFilter('all')
    setDraft(emptyDraft)
  }

  const setDraftField = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const handleAdd = async (e) => {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return
    await addMedia({
      kind,
      title,
      author: kind === 'book' ? draft.author.trim() : null,
      genre: draft.genre || null,
      mediaType: kind === 'video' ? draft.type || null : null,
    })
    setDraft(emptyDraft)
    await reload()
  }

  const openSchedule = (item) =>
    setSched({ id: item.id, date: todayApiDate(), time: '12:00', genre: item.genre || '', type: item.mediaType || '' })

  const submitSchedule = async () => {
    if (!sched) return
    const [y, m, d] = sched.date.split('-').map(Number)
    const [h, min] = sched.time.split(':').map(Number)
    const startDateTime = toApiDateTime(new Date(y, m - 1, d, h, min))
    const { id, genre, type } = sched
    setSched(null)
    await scheduleMedia(id, {
      startDateTime,
      durationMinutes: null,
      genre: genre || null,
      mediaType: kind === 'video' ? type || null : null,
    })
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
      ratingStars: rating || null,
      review: review || null,
      genre: item.genre || null, // поточні вид/жанр, щоб не затерти класифікацію
      mediaType: item.mediaType || null,
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

  const forKind = items.filter((it) => it.kind === kind)
  const counts = {
    planned: forKind.filter((it) => it.status === 'planned').length,
    in_progress: forKind.filter((it) => it.status === 'in_progress').length,
    done: forKind.filter((it) => it.status === 'done').length,
  }

  const q = search.trim().toLowerCase()
  const visible = forKind.filter((it) => {
    if (it.status !== status) return false
    if (q && !(it.title || '').toLowerCase().includes(q) && !(it.author || '').toLowerCase().includes(q)) return false
    if (genreFilter !== 'all' && it.genre !== genreFilter) return false
    if (kind === 'video' && typeFilter !== 'all' && it.mediaType !== typeFilter) return false
    return true
  })

  const genres = genresFor(kind)

  return (
    <div className="watch-page">
      <div className="page-head">
        <h2>{t('nav.watchlist')}</h2>
      </div>

      {/* Під-вкладки Відео / Книги */}
      <div className="watch-kinds">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            className={kind === k.key ? 'watch-kind watch-kind--active' : 'watch-kind'}
            onClick={() => switchKind(k.key)}
          >
            <Icon name={k.icon} className="watch-kind-icon" />
            {t(`watchlist.kind.${k.key}`)}
          </button>
        ))}
      </div>

      {/* Вкладки статусу */}
      <div className="watch-status-tabs">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={status === s.key ? 'watch-status-tab watch-status-tab--active' : 'watch-status-tab'}
            onClick={() => setStatus(s.key)}
          >
            <Icon name={s.icon} className="watch-status-icon" />
            <span>{t(`watchlist.status.${s.key}`)}</span>
            <span className="watch-status-count">{counts[s.key]}</span>
          </button>
        ))}
      </div>

      {/* Пошук + фільтри */}
      <div className="watch-toolbar">
        <label className="watch-search">
          <Icon name="search" className="watch-search-icon" />
          <input
            type="text"
            value={search}
            placeholder={t('watchlist.searchPlaceholder')}
            maxLength={MAX_LEN.title}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select className="watch-filter" value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
          <option value="all">{t('watchlist.filterGenreAll')}</option>
          {genres.map((g) => (
            <option key={g.key} value={g.key}>
              {language === 'en' ? g.en : g.uk}
            </option>
          ))}
        </select>
        {kind === 'video' && (
          <select className="watch-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">{t('watchlist.filterTypeAll')}</option>
            {VIDEO_TYPES.map((v) => (
              <option key={v.key} value={v.key}>
                {language === 'en' ? v.en : v.uk}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Форма додавання — тільки у вкладці "У планах" */}
      {status === 'planned' && (
        <form className="watch-add" onSubmit={handleAdd}>
          <input
            type="text"
            className="watch-add-title"
            value={draft.title}
            placeholder={t(`watchlist.addTitle.${kind}`)}
            maxLength={MAX_LEN.title}
            onChange={(e) => setDraftField({ title: limitText(e.target.value, MAX_LEN.title) })}
          />
          {kind === 'book' && (
            <input
              type="text"
              value={draft.author}
              placeholder={t('watchlist.addAuthor')}
              maxLength={MAX_LEN.name}
              onChange={(e) => setDraftField({ author: filterWords(e.target.value, MAX_LEN.name) })}
            />
          )}
          <select value={draft.genre} onChange={(e) => setDraftField({ genre: e.target.value })}>
            <option value="">{t('watchlist.genreOptional')}</option>
            {genres.map((g) => (
              <option key={g.key} value={g.key}>
                {language === 'en' ? g.en : g.uk}
              </option>
            ))}
          </select>
          {kind === 'video' && (
            <select value={draft.type} onChange={(e) => setDraftField({ type: e.target.value })}>
              <option value="">{t('watchlist.typeOptional')}</option>
              {VIDEO_TYPES.map((v) => (
                <option key={v.key} value={v.key}>
                  {language === 'en' ? v.en : v.uk}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="btn-accent">{t('watchlist.add')}</button>
        </form>
      )}

      {/* Сітка карток */}
      {visible.length === 0 ? (
        <p className="placeholder-text">{t('watchlist.empty')}</p>
      ) : (
        <div className="watch-grid">
          {visible.map((item) => {
            const edit = getEdit(item)
            return (
              <div key={item.id} className="watch-card anim-fade-in-up">
                <div className="watch-card-head">
                  <span className="watch-card-title">{item.title}</span>
                  {item.author && <span className="watch-card-author">{item.author}</span>}
                </div>

                {(item.mediaType || item.genre) && (
                  <div className="watch-badges">
                    {item.mediaType && <span className="watch-badge watch-badge--type">{typeName(item.mediaType, language)}</span>}
                    {item.genre && <span className="watch-badge">{genreName(item.genre, language, item.kind)}</span>}
                  </div>
                )}

                {item.startDate && (
                  <Link to="/app" className="watch-card-when">
                    <Icon name="calendar" className="watch-when-icon" />
                    {new Date(item.startDate).toLocaleDateString()}
                  </Link>
                )}

                {/* "Завершено": зірки (обидва типи) + відгук із збереженням */}
                {item.status === 'done' && (
                  <div className="watch-done-review">
                    <Stars value={edit.rating} onChange={(r) => setEdit(item, { rating: r })} />
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

                {/* Поповер планування (у "У планах") */}
                {sched?.id === item.id ? (
                  <div className="watch-sched">
                    <div className="watch-sched-row">
                      <input type="date" value={sched.date} min={todayApiDate()} onChange={(e) => setSched((s) => ({ ...s, date: e.target.value }))} />
                      <input type="time" value={sched.time} onChange={(e) => setSched((s) => ({ ...s, time: e.target.value }))} />
                    </div>
                    <select value={sched.genre} onChange={(e) => setSched((s) => ({ ...s, genre: e.target.value }))}>
                      <option value="">{t('watchlist.genreOptional')}</option>
                      {genres.map((g) => (
                        <option key={g.key} value={g.key}>
                          {language === 'en' ? g.en : g.uk}
                        </option>
                      ))}
                    </select>
                    {kind === 'video' && (
                      <select value={sched.type} onChange={(e) => setSched((s) => ({ ...s, type: e.target.value }))}>
                        <option value="">{t('watchlist.typeOptional')}</option>
                        {VIDEO_TYPES.map((v) => (
                          <option key={v.key} value={v.key}>
                            {language === 'en' ? v.en : v.uk}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="watch-sched-actions">
                      <button type="button" className="watch-btn-save" onClick={submitSchedule}>
                        {t('watchlist.schedule')}
                      </button>
                      <button type="button" className="watch-btn-ghost" onClick={() => setSched(null)}>
                        {t('watchlist.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="watch-card-actions">
                    {item.status === 'planned' && (
                      <button type="button" className="watch-btn-ghost" onClick={() => openSchedule(item)}>
                        {t('watchlist.schedule')}
                      </button>
                    )}
                    {item.status !== 'done' && (
                      <button type="button" className="watch-btn-ghost" onClick={() => handleFinish(item)}>
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
      )}
    </div>
  )
}
