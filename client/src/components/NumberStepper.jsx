import Icon from './Icon'

// Числове поле з власними стрілками ↑↓ у тон обраної палітри. Нативні системні стрілки
// лічильника (<input type=number>) не піддаються кольоровій стилізації, тож вони сховані
// глобально (index.css), а тут малюються свої кнопки. onChange отримує РЯДКОВЕ значення
// (так само, як e.target.value у звичайного input) — виклики лишаються сумісними.
export default function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  allowDecimal = false,
  disabled = false,
  className = '',
  onBlur,
  ...rest
}) {
  const toNum = (v) => (v === '' || v == null ? 0 : Number(v) || 0)
  const clamp = (v) => {
    if (min != null && v < Number(min)) v = Number(min)
    if (max != null && v > Number(max)) v = Number(max)
    return v
  }
  // Лишаємо лише цифри (і один роздільник, якщо дозволені дроби) — літери/символи не з'являються
  const sanitize = (raw) => {
    let s = String(raw).replace(allowDecimal ? /[^\d.,]/g : /\D/g, '')
    if (allowDecimal) {
      s = s.replace(',', '.')
      const i = s.indexOf('.')
      if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
    }
    return s
  }
  const bump = (dir) => {
    if (disabled) return
    onChange(String(clamp(toNum(value) + dir * step)))
  }
  // На blur приводимо значення до меж [min, max] (порожнє лишаємо порожнім)
  const handleBlur = (e) => {
    if (value !== '' && value != null) {
      const clamped = clamp(toNum(value))
      if (String(clamped) !== String(value)) onChange(String(clamped))
    }
    if (onBlur) onBlur(e)
  }

  return (
    <span className={`num-stepper ${className}`.trim()} data-disabled={disabled ? '' : undefined}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(sanitize(e.target.value))}
        onBlur={handleBlur}
        {...rest}
      />
      <span className="num-stepper-btns">
        <button type="button" tabIndex={-1} aria-label="+" disabled={disabled} onClick={() => bump(1)}>
          <Icon name="chevron-up" />
        </button>
        <button type="button" tabIndex={-1} aria-label="−" disabled={disabled} onClick={() => bump(-1)}>
          <Icon name="chevron-down" />
        </button>
      </span>
    </span>
  )
}
