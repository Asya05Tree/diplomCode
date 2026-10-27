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
  disabled = false,
  className = '',
  ...rest
}) {
  const toNum = (v) => (v === '' || v == null ? 0 : Number(v) || 0)
  const clamp = (v) => {
    if (min != null && v < Number(min)) v = Number(min)
    if (max != null && v > Number(max)) v = Number(max)
    return v
  }
  const bump = (dir) => {
    if (disabled) return
    onChange(String(clamp(toNum(value) + dir * step)))
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
        onChange={(e) => onChange(e.target.value)}
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
