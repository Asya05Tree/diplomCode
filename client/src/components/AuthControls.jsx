import { useI18n } from '../i18n'
import Icon from './Icon'
import { PALETTES } from '../utils/settings'

// Елементи керування виглядом на публічних сторінках (реєстрація / вхід / відновлення пароля):
// вибір кольору (палітра) + перемикач світлої/темної теми + перемикач мови. На цих сторінках
// раніше не було способу змінити тему чи колір — тепер той самий набір, що й на лендингу.
export default function AuthControls({ themeMode, onSetThemeMode, palette, onSetPalette }) {
  const { t, language, setLanguage } = useI18n()
  return (
    <div className="auth-controls">
      {onSetPalette && (
        <label className="auth-palette">
          <span className="auth-palette-label">{t('landing.colorLabel')}</span>
          <select
            className="auth-palette-select"
            value={palette}
            onChange={(e) => onSetPalette(e.target.value)}
          >
            {PALETTES.map((name) => (
              <option key={name} value={name}>{t(`settings.palette.${name}`)}</option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        className="auth-lang-btn"
        onClick={() => setLanguage(language === 'uk' ? 'en' : 'uk')}
        aria-label={language === 'uk' ? 'EN' : 'УК'}
      >
        {language === 'uk' ? 'EN' : 'УК'}
      </button>

      {onSetThemeMode && (
        <label className="switch-wrap" title={t('landing.themeToggle')}>
          <Icon name={themeMode === 'dark' ? 'moon' : 'sun'} className="auth-theme-icon" />
          <span className="switch">
            <input
              type="checkbox"
              checked={themeMode === 'dark'}
              onChange={(e) => onSetThemeMode(e.target.checked ? 'dark' : 'light')}
              aria-label={t('landing.themeToggle')}
            />
            <span className="switch-track" />
          </span>
        </label>
      )}
    </div>
  )
}
