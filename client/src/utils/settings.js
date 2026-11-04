const THEME_MODE_KEY = 'settings:themeMode'
const PALETTE_STYLE_KEY = 'settings:paletteStyle'
const PALETTE_KEY = 'settings:palette'
const WEEK_START_KEY = 'settings:weekStart'
const DATE_FORMAT_KEY = 'settings:dateFormat'
const TIME_FORMAT_KEY = 'settings:timeFormat'

export const PALETTES = ['ocean', 'sunset', 'lavender', 'orange', 'green', 'amber', 'berry']

// Формат часу (planner-spec.md §4.10 "формат времени"): '24' — 24-годинний (13:00),
// '12' — 12-годинний із am/pm (1:00 pm). Впливає лише на показ, не на зберігання.
export const TIME_FORMATS = ['24', '12']

// Числові формати дати (planner-spec.md §4.10 "формат дати"): порядок число/місяць/рік тощо.
// dmy — число/місяць/рік, mdy — місяць/число/рік, ymd — рік/місяць/число, ydm — рік/число/місяць.
export const DATE_FORMATS = ['dmy', 'mdy', 'ymd', 'ydm']

// Акцентні пари кольорів на палітру/стиль (planner-spec.md §3.1 AccentColor,
// §4.11 "пастельна палитра, светлая и тёмная темы") — не залежать від light/dark,
// лише від обраної палітри та того, пастельний це варіант чи насичений.
export const PALETTE_COLORS = {
  ocean: { pastel: ['#B3E5FC', '#C5CAE9'], vivid: ['#00C6FF', '#0072FF'] },
  sunset: { pastel: ['#FF80AB', '#FFE0B2'], vivid: ['#FF416C', '#FFB347'] },
  lavender: { pastel: ['#D1C4E9', '#F8BBD0'], vivid: ['#8360C3', '#FF8FBF'] },
  orange: { pastel: ['#FFCCBC', '#FFE0B2'], vivid: ['#FF7E5F', '#FEB47B'] },
  green: { pastel: ['#C8E6C9', '#DCEDC8'], vivid: ['#56AB2F', '#A8E063'] },
  amber: { pastel: ['#FFF1A8', '#FFD59E'], vivid: ['#FFD200', '#FF8008'] },
  berry: { pastel: ['#FAC6E6', '#D7BBF0'], vivid: ['#FF52A2', '#9B36D9'] },
}

export function getThemeMode() {
  return localStorage.getItem(THEME_MODE_KEY) === 'dark' ? 'dark' : 'light'
}

export function setThemeMode(mode) {
  localStorage.setItem(THEME_MODE_KEY, mode === 'dark' ? 'dark' : 'light')
}

export function getPaletteStyle() {
  return localStorage.getItem(PALETTE_STYLE_KEY) === 'vivid' ? 'vivid' : 'pastel'
}

export function setPaletteStyle(style) {
  localStorage.setItem(PALETTE_STYLE_KEY, style === 'vivid' ? 'vivid' : 'pastel')
}

export function getPalette() {
  const stored = localStorage.getItem(PALETTE_KEY)
  return PALETTES.includes(stored) ? stored : 'ocean'
}

export function setPalette(palette) {
  localStorage.setItem(PALETTE_KEY, PALETTES.includes(palette) ? palette : 'ocean')
}

// Перший день тижня для всіх календарів проєкту (planner-spec.md §4.10): ISO-номер 1=Пн..7=Нд.
// Дефолт — понеділок (1). Впливає лише на порядок показу днів, не на кодування даних.
export function getWeekStart() {
  const n = Number(localStorage.getItem(WEEK_START_KEY))
  return n >= 1 && n <= 7 ? n : 1
}

export function setWeekStart(n) {
  const v = Number(n)
  localStorage.setItem(WEEK_START_KEY, String(v >= 1 && v <= 7 ? v : 1))
}

export function getDateFormat() {
  const stored = localStorage.getItem(DATE_FORMAT_KEY)
  return DATE_FORMATS.includes(stored) ? stored : 'dmy'
}

export function setDateFormat(format) {
  localStorage.setItem(DATE_FORMAT_KEY, DATE_FORMATS.includes(format) ? format : 'dmy')
}

export function getTimeFormat() {
  const stored = localStorage.getItem(TIME_FORMAT_KEY)
  return TIME_FORMATS.includes(stored) ? stored : '24'
}

export function setTimeFormat(format) {
  localStorage.setItem(TIME_FORMAT_KEY, TIME_FORMATS.includes(format) ? format : '24')
}
