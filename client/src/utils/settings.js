const THEME_MODE_KEY = 'settings:themeMode'
const PALETTE_STYLE_KEY = 'settings:paletteStyle'
const PALETTE_KEY = 'settings:palette'

export const PALETTES = ['ocean', 'sunset', 'lavender', 'orange', 'green', 'amber', 'berry']

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
  return localStorage.getItem(PALETTE_STYLE_KEY) === 'pastel' ? 'pastel' : 'vivid'
}

export function setPaletteStyle(style) {
  localStorage.setItem(PALETTE_STYLE_KEY, style === 'vivid' ? 'vivid' : 'pastel')
}

export function getPalette() {
  const stored = localStorage.getItem(PALETTE_KEY)
  return PALETTES.includes(stored) ? stored : 'amber'
}

export function setPalette(palette) {
  localStorage.setItem(PALETTE_KEY, PALETTES.includes(palette) ? palette : 'ocean')
}
