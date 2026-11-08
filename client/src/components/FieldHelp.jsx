import { useState } from 'react'
import './FieldHelp.css'

// Підказка для поля форми: маленька кнопка «(!)» поруч із назвою поля. Клік відкриває/закриває
// коротке пояснення — що це за поле, що вводити, інколи навіщо. Текст передається вже
// локалізованим (через t(...)). Якщо тексту нема — нічого не показуємо.
export default function FieldHelp({ text, label }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <span className="field-help">
      <button
        type="button"
        className="field-help-toggle"
        aria-expanded={open}
        aria-label={label || '?'}
        title={label || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        !
      </button>
      {open && <span className="field-help-text" role="note">{text}</span>}
    </span>
  )
}
