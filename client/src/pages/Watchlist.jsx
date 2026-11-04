import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import { addMedia, deleteMedia, getMedia, returnMedia, scheduleMedia, setMediaStatus, updateMedia } from '../api/media'
import { genresFor, genreName, typeName, VIDEO_TYPES } from '../utils/watchlistTaxonomy'
import { MAX_LEN, filterWords, limitText } from '../utils/validation'
import { fromApiDateTime, formatTime, toApiDate, toApiDateTime, todayApiDate } from '../utils/date'
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
// Вкладка «Борги» — лише для книг (прострочені неповернені бібліотечні книги)
const DEBT_STATUS = { key: 'debt', icon: 'warning' }

const emptyDraft = { title: '', author: '', genre: '', type: '', isLibrary: false, returnDeadline: '' }

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
  const { t, language, formatDate } = useI18n()

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
  const [reviewEditId, setReviewEditId] = useState(null) // який відгук зараз редагується
  const [editId, setEditId] = useState(null) // яку картку редагуємо (метадані / перепланування)
  const [editForm, setEditForm] = useState(null) // чернетка редагування відкритої картки

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

  // Зміна типу скидає фільтри, чернетку й статус (у відео немає вкладки «Борги»)
  const switchKind = (k) => {
    setKind(k)
    setGenreFilter('all')
    setTypeFilter('all')
    setDraft(emptyDraft)
    if (status === 'debt') setStatus('planned')
  }

  const setDraftField = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const handleAdd = async (e) => {
    e.preventDefault()
    const title = draft.title.trim()
    if (!title) return
    const isLibrary = kind === 'book' && draft.isLibrary
    await addMedia({
      kind,
      title,
      author: kind === 'book' ? draft.author.trim() : null,
      genre: draft.genre || null,
      mediaType: kind === 'video' ? draft.type || null : null,
      isLibrary,
      returnDeadline: isLibrary && draft.returnDeadline ? draft.returnDeadline : null,
    })
    setDraft(emptyDraft)
    await reload()
  }

  // Чекбокс «повернено» (true) або його зняття в режимі редагування (false) — із логікою
  // переміщення на боці сервера (planned→видалення, in_progress/борг→завершено тощо).
  const handleReturnToggle = async (item, returned) => {
    await returnMedia(item.id, returned)
    setEditId(null)
    setEditForm(null)
    await reload()
  }

  // Відкрити редагування картки: для «у планах» — метадані, для «у процесі» — дата/час.
  const startEdit = (item) => {
    setReviewEditId(null)
    setEditId(item.id)
    const dt = item.startDate ? fromApiDateTime(item.startDate) : null
    setEditForm({
      title: item.title || '',
      author: item.author || '',
      genre: item.genre || '',
      type: item.mediaType || '',
      isLibrary: Boolean(item.isLibrary),
      returnDeadline: item.returnDeadline ? item.returnDeadline.slice(0, 10) : '',
      date: dt ? toApiDate(dt) : todayApiDate(),
      time: dt ? formatTime(dt) : '12:00',
    })
  }
  const cancelEdit = () => {
    setEditId(null)
    setEditForm(null)
  }

  const handleSaveEdit = async (item) => {
    if (!editForm) return
    const title = editForm.title.trim()
    if (!title) return
    const isLibrary = item.kind === 'book' && editForm.isLibrary
    // Перепланування лише для вже запланованих (є подія в календарі)
    const startDateTime =
      item.status === 'in_progress' && item.taskId
        ? toApiDateTime(
            (() => {
              const [y, m, d] = editForm.date.split('-').map(Number)
              const [h, min] = editForm.time.split(':').map(Number)
              return new Date(y, m - 1, d, h, min)
            })(),
          )
        : null
    await updateMedia(item.id, {
      title,
      author: item.kind === 'book' ? editForm.author.trim() : null,
      ratingStars: item.ratingStars ?? null,
      review: item.review || null,
      genre: editForm.genre || null,
      mediaType: item.kind === 'video' ? editForm.type || null : null,
      isLibrary,
      returnDeadline: isLibrary && editForm.returnDeadline ? editForm.returnDeadline : null,
      startDateTime,
    })
    cancelEdit()
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

  const dropEdit = (id) =>
    setEdits((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })

  // Відкрити/закрити режим редагування відгуку (кнопка-олівець ↔ форма зі «Зберегти»)
  const startReview = (item) => setReviewEditId(item.id)
  const cancelReview = (item) => {
    dropEdit(item.id)
    setReviewEditId(null)
  }

  const handleSaveDone = async (item) => {
    const { rating, review } = getEdit(item)
    try {
      await updateMedia(item.id, {
        title: item.title,
        author: item.author,
        ratingStars: rating || null,
        review: review || null,
        genre: item.genre || null, // поточні вид/жанр, щоб не затерти класифікацію
        mediaType: item.mediaType || null,
      })
    } catch {
      return // лишаємо введений текст, якщо зберегти не вдалося
    }
    dropEdit(item.id)
    setReviewEditId(null) // після збереження повертаємось до перегляду з кнопкою-олівцем
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
  const statuses = kind === 'book' ? [...STATUSES, DEBT_STATUS] : STATUSES
  const counts = {
    planned: forKind.filter((it) => it.status === 'planned' && !it.isDebt).length,
    in_progress: forKind.filter((it) => it.status === 'in_progress' && !it.isDebt).length,
    done: forKind.filter((it) => it.status === 'done').length,
    debt: forKind.filter((it) => it.isDebt).length,
  }

  const q = search.trim().toLowerCase()
  const visible = forKind.filter((it) => {
    // Борги мають власну вкладку; прострочені неповернені книги не дублюються в planned/in_progress
    if (status === 'debt') {
      if (!it.isDebt) return false
    } else if (it.status !== status || it.isDebt) {
      return false
    }
    if (q && !(it.title || '').toLowerCase().includes(q) && !(it.author || '').toLowerCase().includes(q)) return false
    if (genreFilter !== 'all' && it.genre !== genreFilter) return false
    if (kind === 'video' && typeFilter !== 'all' && it.mediaType !== typeFilter) return false
    return true
  })

  const genres = genresFor(kind)

  return (
    <div className="watch-page">
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
        {statuses.map((s) => (
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
          {/* Бібліотечна / позичена книга → дедлайн повернення (потрапляє у спільний календар) */}
          {kind === 'book' && (
            <label className="watch-lib-check">
              <input
                type="checkbox"
                checked={draft.isLibrary}
                onChange={(e) => setDraftField({ isLibrary: e.target.checked })}
              />
              {t('watchlist.library')}
            </label>
          )}
          {kind === 'book' && draft.isLibrary && (
            <input
              type="date"
              value={draft.returnDeadline}
              min={todayApiDate()}
              title={t('watchlist.returnDeadline')}
              onChange={(e) => setDraftField({ returnDeadline: e.target.value })}
            />
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

                {/* Примітка про бібліотечну/позичену книгу + дедлайн/стан повернення */}
                {item.kind === 'book' && item.isLibrary && (
                  <div className={item.isDebt ? 'watch-library watch-library--debt' : 'watch-library'}>
                    <Icon name="book-open" className="watch-when-icon" />
                    <span className="watch-library-label">{t('watchlist.libraryNote')}</span>
                    {item.returnDeadline && !item.isReturned && (
                      <span className="watch-library-due">
                        {t('watchlist.returnBy', { date: formatDate(item.returnDeadline) })}
                      </span>
                    )}
                    {item.isReturned && <span className="watch-library-returned">{t('watchlist.returnedNote')}</span>}
                  </div>
                )}

                {item.startDate && (
                  <Link to="/app" className="watch-card-when">
                    <Icon name="calendar" className="watch-when-icon" />
                    {formatDate(item.startDate)}
                  </Link>
                )}

                {/* "Завершено": зірки (обидва типи) + відгук. У режимі перегляду — кнопка-олівець;
                    у режимі редагування — поля + «Зберегти». Після збереження кнопка зникає. */}
                {item.status === 'done' && (
                  <div className="watch-done-review">
                    {reviewEditId === item.id ? (
                      <>
                        <Stars value={edit.rating} onChange={(r) => setEdit(item, { rating: r })} />
                        <textarea
                          rows={2}
                          value={edit.review}
                          placeholder={t('watchlist.reviewPlaceholder')}
                          maxLength={MAX_LEN.description}
                          onChange={(e) => setEdit(item, { review: limitText(e.target.value, MAX_LEN.description) })}
                        />
                        {/* Реактивація бібліотечної книги: зняти «повернено» → знову у роботу/борги */}
                        {item.kind === 'book' && item.isLibrary && (
                          <label className="watch-return watch-return--edit">
                            <input
                              type="checkbox"
                              checked={item.isReturned}
                              onChange={() => handleReturnToggle(item, !item.isReturned)}
                            />
                            {t('watchlist.returned')}
                          </label>
                        )}
                        <div className="watch-save-row">
                          <button type="button" className="watch-btn-save" onClick={() => handleSaveDone(item)}>
                            {t('watchlist.saveReview')}
                          </button>
                          <button type="button" className="watch-btn-ghost" onClick={() => cancelReview(item)}>
                            {t('watchlist.cancel')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="watch-review-ro">
                        {(item.ratingStars || item.review) ? (
                          <>
                            {item.ratingStars ? <Stars value={item.ratingStars} readOnly /> : null}
                            {item.review && <p className="watch-review-text">{item.review}</p>}
                          </>
                        ) : (
                          <span className="watch-review-empty">{t('watchlist.noReview')}</span>
                        )}
                        <button
                          type="button"
                          className="watch-card-btn"
                          aria-label={t('common.edit')}
                          data-tooltip={t('common.edit')}
                          onClick={() => startReview(item)}
                        >
                          <Icon name="pencil" />
                        </button>
                      </div>
                    )}
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
                        {t(kind === 'book' ? 'watchlist.scheduleBook' : 'watchlist.scheduleVideo')}
                      </button>
                      <button type="button" className="watch-btn-ghost" onClick={() => setSched(null)}>
                        {t('watchlist.cancel')}
                      </button>
                    </div>
                  </div>
                ) : editId === item.id && editForm ? (
                  /* Редагування картки: «у планах» — метадані; «у процесі» — лише дата/час */
                  <div className="watch-sched">
                    {item.status === 'planned' ? (
                      <>
                        <input
                          type="text"
                          value={editForm.title}
                          placeholder={t(`watchlist.addTitle.${item.kind}`)}
                          maxLength={MAX_LEN.title}
                          onChange={(e) => setEditForm((f) => ({ ...f, title: limitText(e.target.value, MAX_LEN.title) }))}
                        />
                        {item.kind === 'book' && (
                          <input
                            type="text"
                            value={editForm.author}
                            placeholder={t('watchlist.addAuthor')}
                            maxLength={MAX_LEN.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, author: filterWords(e.target.value, MAX_LEN.name) }))}
                          />
                        )}
                        <select value={editForm.genre} onChange={(e) => setEditForm((f) => ({ ...f, genre: e.target.value }))}>
                          <option value="">{t('watchlist.genreOptional')}</option>
                          {genres.map((g) => (
                            <option key={g.key} value={g.key}>{language === 'en' ? g.en : g.uk}</option>
                          ))}
                        </select>
                        {item.kind === 'video' && (
                          <select value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}>
                            <option value="">{t('watchlist.typeOptional')}</option>
                            {VIDEO_TYPES.map((v) => (
                              <option key={v.key} value={v.key}>{language === 'en' ? v.en : v.uk}</option>
                            ))}
                          </select>
                        )}
                        {item.kind === 'book' && (
                          <label className="watch-lib-check">
                            <input
                              type="checkbox"
                              checked={editForm.isLibrary}
                              onChange={(e) => setEditForm((f) => ({ ...f, isLibrary: e.target.checked }))}
                            />
                            {t('watchlist.library')}
                          </label>
                        )}
                        {item.kind === 'book' && editForm.isLibrary && (
                          <input
                            type="date"
                            value={editForm.returnDeadline}
                            title={t('watchlist.returnDeadline')}
                            onChange={(e) => setEditForm((f) => ({ ...f, returnDeadline: e.target.value }))}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <div className="watch-sched-row">
                          <input type="date" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} />
                          <input type="time" value={editForm.time} onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))} />
                        </div>
                        {item.kind === 'book' && item.isLibrary && (
                          <input
                            type="date"
                            value={editForm.returnDeadline}
                            title={t('watchlist.returnDeadline')}
                            onChange={(e) => setEditForm((f) => ({ ...f, returnDeadline: e.target.value }))}
                          />
                        )}
                      </>
                    )}
                    {/* Реактивація: зняти «повернено» (книга повернеться у роботу/борги) */}
                    {item.kind === 'book' && item.isLibrary && (
                      <label className="watch-return watch-return--edit">
                        <input
                          type="checkbox"
                          checked={item.isReturned}
                          onChange={() => handleReturnToggle(item, !item.isReturned)}
                        />
                        {t('watchlist.returned')}
                      </label>
                    )}
                    <div className="watch-sched-actions">
                      <button type="button" className="watch-btn-save" onClick={() => handleSaveEdit(item)}>
                        {t('watchlist.saveReview')}
                      </button>
                      <button type="button" className="watch-btn-ghost" onClick={cancelEdit}>
                        {t('watchlist.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="watch-card-actions">
                    {/* Чекбокс «повернено» для бібліотечної книги; після повернення — неактивний */}
                    {item.kind === 'book' && item.isLibrary && (
                      <label className="watch-return">
                        <input
                          type="checkbox"
                          checked={item.isReturned}
                          disabled={item.isReturned}
                          onChange={() => handleReturnToggle(item, true)}
                        />
                        {t('watchlist.returned')}
                      </label>
                    )}
                    {item.status === 'planned' && (
                      <button type="button" className="watch-btn-ghost" onClick={() => openSchedule(item)}>
                        {t(kind === 'book' ? 'watchlist.scheduleBook' : 'watchlist.scheduleVideo')}
                      </button>
                    )}
                    {item.status !== 'done' && (
                      <button type="button" className="watch-btn-ghost" onClick={() => handleFinish(item)}>
                        {t('watchlist.finish')}
                      </button>
                    )}
                    {item.status !== 'done' && (
                      <button
                        type="button"
                        className="watch-card-btn"
                        aria-label={t('watchlist.edit')}
                        data-tooltip={t('watchlist.edit')}
                        onClick={() => startEdit(item)}
                      >
                        <Icon name="pencil" />
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
