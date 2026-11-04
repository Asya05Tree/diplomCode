import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import Board from '../components/notes/Board'
import { getNotes, addNote, updateNote, removeNote } from '../api/notes'
import './Notes.css'

// Розділ "Нотатки": дві вкладки — Нотатки (картки-квадратики з обмеженим текстом) і Дошка
// (малювання кольорами з експортом у JPEG). Нотатки зберігаються в БД, дошка — локально.
const NOTE_COLORS = ['#fff3b0', '#cdeffd', '#d7f5d3', '#ffd6e0', '#e5d4ff', '#ffe0b3']
const MAX_LEN = 280
const MAX_NOTES = 30 // обмеження кількості нотаток

export default function Notes() {
  const { t } = useI18n()
  const [tab, setTab] = useState('notes') // 'notes' | 'board'
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNotes()
      .then((data) => setNotes(data ?? []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false))
  }, [])

  const patchLocal = (id, changes) =>
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...changes } : n)))

  const handleAdd = async () => {
    if (notes.length >= MAX_NOTES) return // досягнуто ліміту
    const color = NOTE_COLORS[notes.length % NOTE_COLORS.length]
    const { id } = await addNote({ text: '', color })
    setNotes((prev) => [...prev, { id, text: '', color, position: prev.length }])
  }

  const handleText = (id, text) => patchLocal(id, { text: text.slice(0, MAX_LEN) })

  // Зберігаємо текст на blur (щоб не слати запит на кожну літеру)
  const saveNote = (note) => updateNote(note.id, { text: note.text, color: note.color }).catch(() => {})

  const handleColor = (note, color) => {
    patchLocal(note.id, { color })
    updateNote(note.id, { text: note.text, color }).catch(() => {})
  }

  const handleRemove = async (id) => {
    await removeNote(id).catch(() => {})
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="notes-page">
      <div className="notes-tabs">
        <button
          type="button"
          className={tab === 'notes' ? 'notes-tab notes-tab--active' : 'notes-tab'}
          onClick={() => setTab('notes')}
        >
          <Icon name="notes" /> {t('notes.tab.notes')}
        </button>
        <button
          type="button"
          className={tab === 'board' ? 'notes-tab notes-tab--active' : 'notes-tab'}
          onClick={() => setTab('board')}
        >
          <Icon name="board" /> {t('notes.tab.board')}
        </button>
      </div>

      {tab === 'notes' ? (
        loading ? (
          <p className="placeholder-text">{t('common.loading')}</p>
        ) : (
          <div className="notes-grid">
            {notes.map((note) => (
              <div key={note.id} className="note-card" style={{ background: note.color }}>
                <textarea
                  className="note-text"
                  value={note.text}
                  maxLength={MAX_LEN}
                  placeholder={t('notes.placeholder')}
                  onChange={(e) => handleText(note.id, e.target.value)}
                  onBlur={() => saveNote(note)}
                />
                <div className="note-footer">
                  <div className="note-colors">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={note.color === c ? 'note-color note-color--active' : 'note-color'}
                        style={{ background: c }}
                        onClick={() => handleColor(note, c)}
                        aria-label={c}
                      />
                    ))}
                  </div>
                  <span className="note-count">{note.text.length}/{MAX_LEN}</span>
                  <button
                    type="button"
                    className="note-remove"
                    onClick={() => handleRemove(note.id)}
                    aria-label={t('common.delete')}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))}

            {notes.length < MAX_NOTES ? (
              <button type="button" className="note-add" onClick={handleAdd}>
                <Icon name="plus" />
                <span>{t('notes.add')}</span>
              </button>
            ) : (
              <div className="note-add note-add--full">
                <Icon name="notes" />
                <span>{t('notes.limitReached', { max: MAX_NOTES })}</span>
              </div>
            )}
          </div>
        )
      ) : (
        <Board />
      )}
    </div>
  )
}
