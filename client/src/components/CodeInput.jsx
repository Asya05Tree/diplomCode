import { useRef } from 'react'
import './CodeInput.css'

// Шість окремих клітинок для коду підтвердження. Вставка (Ctrl+V) розкладає весь
// скопійований з листа код по клітинках одразу, а не тільки в ту, куди вставили.
export default function CodeInput({ value, onChange, length = 6 }) {
  const inputsRef = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const applyDigits = (startIndex, rawText) => {
    const chars = rawText.replace(/\D/g, '').split('')
    if (chars.length === 0) return
    const next = digits.slice()
    let cursor = startIndex
    for (const ch of chars) {
      if (cursor >= length) break
      next[cursor] = ch
      cursor += 1
    }
    onChange(next.join(''))
    inputsRef.current[Math.min(cursor, length - 1)]?.focus()
  }

  const handleChange = (index, event) => {
    const raw = event.target.value
    if (!raw) {
      const next = digits.slice()
      next[index] = ''
      onChange(next.join(''))
      return
    }
    applyDigits(index, raw)
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (index, event) => {
    event.preventDefault()
    applyDigits(index, event.clipboardData.getData('text'))
  }

  return (
    <div className="code-input">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          className="code-input-cell"
        />
      ))}
    </div>
  )
}
