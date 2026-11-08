import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'

// Дошка для малювання: кольори (червоний, жовтий, зелений тощо), гумка, очищення та збереження
// намальованого у JPEG на пристрій. Малюнок зберігається локально (localStorage), тож не губиться
// при перезавантаженні — на сервер нічого не йде (вимога).
const WIDTH = 1200
const HEIGHT = 720
const BG = '#ffffff'
const STORAGE_KEY = 'notesBoard'

// Палітра: кольори олівця + гумка (малює кольором фону)
const COLORS = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#222222']
const SIZES = [3, 7, 14]

export default function Board() {
  const { t } = useI18n()
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [erasing, setErasing] = useState(false)

  // Ініціалізація полотна: білий фон + відновлення збереженого малюнка
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctxRef.current = ctx

    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, WIDTH, HEIGHT)
      img.src = saved
    }
  }, [])

  // Перетворення координат вказівника у координати полотна (полотно масштабується по ширині)
  const pointFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    }
  }

  const start = (e) => {
    e.preventDefault()
    drawing.current = true
    last.current = pointFromEvent(e)
    canvasRef.current.setPointerCapture?.(e.pointerId)
  }

  const move = (e) => {
    if (!drawing.current) return
    const ctx = ctxRef.current
    const p = pointFromEvent(e)
    ctx.strokeStyle = erasing ? BG : color
    ctx.lineWidth = erasing ? size * 3 : size
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    persist()
  }

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, canvasRef.current.toDataURL('image/png'))
    } catch {
      /* перевищено квоту localStorage — ігноруємо, малюнок просто не збережеться між сесіями */
    }
  }

  const clear = () => {
    const ctx = ctxRef.current
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    localStorage.removeItem(STORAGE_KEY)
  }

  // Збереження у JPEG: фон уже білий, тож прозорості немає — експортуємо напряму
  const saveJpeg = () => {
    const url = canvasRef.current.toDataURL('image/jpeg', 0.92)
    const a = document.createElement('a')
    a.href = url
    a.download = `vsetut-board-${new Date().toISOString().slice(0, 10)}.jpg`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="board">
      <div className="board-toolbar">
        <div className="board-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={!erasing && color === c ? 'board-color board-color--active' : 'board-color'}
              style={{ background: c }}
              onClick={() => { setColor(c); setErasing(false) }}
              aria-label={c}
            />
          ))}
        </div>
        <div className="board-sizes">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={size === s ? 'board-size board-size--active' : 'board-size'}
              onClick={() => setSize(s)}
              aria-label={`${s}px`}
            >
              <span className="board-size-dot" style={{ width: s + 4, height: s + 4 }} />
            </button>
          ))}
        </div>
        <div className="board-tools">
          <button
            type="button"
            className={erasing ? 'board-tool board-tool--active' : 'board-tool'}
            onClick={() => setErasing((v) => !v)}
          >
            <Icon name="eraser" /> {t('notes.board.eraser')}
          </button>
          <button type="button" className="board-tool" onClick={clear}>
            <Icon name="trash" /> {t('notes.board.clear')}
          </button>
          <button type="button" className="board-tool board-tool--accent" onClick={saveJpeg}>
            <Icon name="download" /> {t('notes.board.saveJpeg')}
          </button>
        </div>
      </div>

      <div className="board-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="board-canvas"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>

      {/* Полотно зберігається лише в цьому браузері (localStorage) і не синхронізується між пристроями. */}
      <p className="board-device-note">
        <Icon name="info" /> {t('notes.board.deviceOnly')}
      </p>
    </div>
  )
}
