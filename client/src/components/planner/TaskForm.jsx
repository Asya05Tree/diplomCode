import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { createTask, createRecurrenceRule } from '../../api/tasks'
import { addMedia, scheduleMedia } from '../../api/media'
import { toApiDate, toApiDateTime, formatTime, todayApiDate } from '../../utils/date'
import { MAX_LEN, filterWords, limitText } from '../../utils/validation'
import { createDefaultRecurrenceValue, recurrenceValueToPayload, validateRecurrenceValue } from '../../utils/recurrence'
import RecurrenceFields from './RecurrenceFields'
import ShoppingTaskTabs from './ShoppingTaskTabs'
import './TaskForm.css'

// Дефолтні назви у випадаючому списку справа від заголовка — обрання одного з них просто
// підставляє текст у поле назви (користувач може далі змінити його вручну як завгодно).
// watchMedia/readMedia — особливі: замість задачі "як є" створюють елемент у вкладці
// «Перегляд і читання» (в процесі) з привʼязаною подією календаря.
const TITLE_PRESETS = ['cookFood', 'goShopping', 'watchMedia', 'readMedia']
const MEDIA_PRESETS = { watchMedia: 'video', readMedia: 'book' }

// Спільна форма створення задачі, за шаблоном coding-guide.md §8: назва, коли (один раз /
// повторюється — тип правила й розклад делегуються RecurrenceFields), тривалість і дедлайн — необов'язкові.
export default function TaskForm({ token, initialDate, defaultRecurring = false, onSaved, onCancel }) {
  const { t } = useI18n()

  const presetLabel = (key) => t(`taskForm.preset.${key}`)

  const [title, setTitle] = useState('')
  const [titlePreset, setTitlePreset] = useState('')
  const [description, setDescription] = useState('')
  // Поля медіа-пресета (назва фільму/книги та автор) тримаємо окремо від title задачі
  const [mediaTitle, setMediaTitle] = useState('')
  const [mediaAuthor, setMediaAuthor] = useState('')
  const [repeats, setRepeats] = useState(defaultRecurring)
  const [date, setDate] = useState(toApiDate(initialDate))
  const [time, setTime] = useState(formatTime(initialDate))
  const [duration, setDuration] = useState('')
  const [deadline, setDeadline] = useState('')

  const [recurrence, setRecurrence] = useState(() => createDefaultRecurrenceValue(initialDate))

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Світч "своя назва / з випадаючого списку": вибір у списку підставляє текст у поле,
  // а ручне редагування поля знімає виділення пресету, якщо текст більше йому не відповідає
  const handleTitleChange = (value) => {
    setTitle(value)
    setTitlePreset(TITLE_PRESETS.find((key) => presetLabel(key) === value) ?? '')
  }

  const handlePresetSelect = (e) => {
    const key = e.target.value
    setTitlePreset(key)
    // Медіа-пресет не підставляє текст у title задачі — у нього своє поле назви
    if (key in MEDIA_PRESETS) setTitle('')
    else if (key) setTitle(presetLabel(key))
  }

  const isShoppingTask = title.trim() === presetLabel('goShopping')
  const mediaKind = MEDIA_PRESETS[titlePreset] ?? null // 'video' | 'book' | null
  const isMediaTask = mediaKind !== null

  // Похід у магазин / перегляд-читання завжди прив'язані до конкретного моменту —
  // повторення для них немає сенсу, тому перемикач "коли" ховаємо і скидаємо на "один раз"
  useEffect(() => {
    if (isShoppingTask || isMediaTask) setRepeats(false)
  }, [isShoppingTask, isMediaTask])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    // Медіа-пресет: створюємо елемент вкладки «Перегляд і читання» (в процесі) з подією
    // календаря на обрану дату/час — замість звичайної задачі.
    if (isMediaTask) {
      const mt = mediaTitle.trim()
      if (!mt) {
        setError(t('taskForm.errorTitleRequired'))
        return
      }
      if (date < todayApiDate()) {
        setError(t('taskForm.errorDateInPast'))
        return
      }
      setBusy(true)
      try {
        const created = await addMedia({
          kind: mediaKind,
          title: mt,
          author: mediaKind === 'book' ? mediaAuthor.trim() : null,
        })
        const [y, m, d] = date.split('-').map(Number)
        const [h, min] = time.split(':').map(Number)
        const startDateTime = toApiDateTime(new Date(y, m - 1, d, h, min))
        await scheduleMedia(created.id, { startDateTime, durationMinutes: null })
        onSaved(created)
      } catch {
        setError(t('taskForm.errorSave'))
      } finally {
        setBusy(false)
      }
      return
    }

    if (!title.trim()) {
      setError(t('taskForm.errorTitleRequired'))
      return
    }
    if (repeats) {
      const errorCode = validateRecurrenceValue(recurrence)
      if (errorCode) {
        setError(t(`taskForm.${errorCode}`))
        return
      }
      if (recurrence.startDate < todayApiDate()) {
        setError(t('taskForm.errorStartDateInPast'))
        return
      }
    } else if (date < todayApiDate()) {
      setError(t('taskForm.errorDateInPast'))
      return
    }

    setBusy(true)
    try {
      if (repeats) {
        const rule = await createRecurrenceRule(token, {
          title: title.trim(),
          description: description.trim() || null,
          durationMinutes: duration ? Number(duration) : null,
          ...recurrenceValueToPayload(recurrence),
        })
        onSaved(rule)
      } else {
        const [y, m, d] = date.split('-').map(Number)
        const [h, min] = time.split(':').map(Number)
        const startDateTime = toApiDateTime(new Date(y, m - 1, d, h, min))
        const deadlineDateTime = deadline ? `${deadline}T23:59:00` : null

        const created = await createTask(token, {
          title: title.trim(),
          description: description.trim() || null,
          startDateTime,
          durationMinutes: duration ? Number(duration) : null,
          deadline: deadlineDateTime,
        })
        onSaved(created)
      }
    } catch {
      setError(t('taskForm.errorSave'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="task-form-row">
        {isMediaTask ? (
          <label>
            {t(`taskForm.mediaTitle.${mediaKind}`)}
            <input
              value={mediaTitle}
              onChange={(e) => setMediaTitle(limitText(e.target.value, MAX_LEN.title))}
              placeholder={t(`taskForm.mediaTitlePlaceholder.${mediaKind}`)}
              maxLength={MAX_LEN.title}
              required
            />
          </label>
        ) : (
          <label>
            {t('taskForm.titleLabel')}
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t('taskForm.titlePlaceholder')}
              required
            />
          </label>
        )}
        <label>
          {t('taskForm.presetLabel')}
          <select value={titlePreset} onChange={handlePresetSelect}>
            <option value="">{t('taskForm.preset.custom')}</option>
            {TITLE_PRESETS.map((key) => (
              <option key={key} value={key}>
                {presetLabel(key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isShoppingTask ? (
        <ShoppingTaskTabs />
      ) : isMediaTask ? (
        mediaKind === 'book' ? (
          <label>
            {t('taskForm.mediaAuthor')}
            <input
              value={mediaAuthor}
              onChange={(e) => setMediaAuthor(filterWords(e.target.value, MAX_LEN.name))}
              placeholder={t('taskForm.mediaAuthorPlaceholder')}
              maxLength={MAX_LEN.name}
            />
          </label>
        ) : null
      ) : (
        <label>
          {t('taskForm.description')}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </label>
      )}

      {!isShoppingTask && !isMediaTask && (
        <div className="task-form-when">
          <span className="task-form-when-label">{t('taskForm.when')}</span>
          <label className="task-form-radio">
            <input type="radio" checked={!repeats} onChange={() => setRepeats(false)} />
            {t('taskForm.once')}
          </label>
          <label className="task-form-radio">
            <input type="radio" checked={repeats} onChange={() => setRepeats(true)} />
            {t('taskForm.repeats')}
          </label>
        </div>
      )}

      {repeats && !isShoppingTask ? (
        <RecurrenceFields value={recurrence} onChange={setRecurrence} />
      ) : (
        <div className="task-form-row">
          <label>
            {t('taskForm.date')}
            <input type="date" value={date} min={todayApiDate()} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            {t('taskForm.time')}
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>
        </div>
      )}

      {!isShoppingTask && !isMediaTask && (
        <div className="task-form-row">
          <label>
            {t('taskForm.duration')}
            <input
              type="number"
              min="1"
              max="1440"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              onBlur={(e) => setDuration(String(Math.min(1440, Math.max(1, Math.round(Number(e.target.value) || 1)))))}
            />
          </label>
          {!repeats && (
            <label>
              {t('taskForm.deadline')}
              <input type="date" value={deadline} min={todayApiDate()} onChange={(e) => setDeadline(e.target.value)} />
            </label>
          )}
        </div>
      )}

      {error && <p className="task-form-error">{error}</p>}

      <div className="task-form-actions">
        <button type="submit" className="task-form-submit" disabled={busy}>{t('taskForm.save')}</button>
        <button type="button" className="task-form-cancel" onClick={onCancel}>{t('taskForm.cancel')}</button>
      </div>
    </form>
  )
}
