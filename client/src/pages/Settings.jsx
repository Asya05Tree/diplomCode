import { useOutletContext } from 'react-router-dom'
import { useI18n } from '../i18n'
import { PALETTES, PALETTE_COLORS } from '../utils/settings'
import './Settings.css'

// Налаштування (planner-spec.md §4.10): мова, тема, акцентна палітра й вихід з акаунта.
// Тема/стиль/палітра підняті в App.jsx (застосовуються до всього додатку через
// data-* атрибути на кореневому div), тому сюди приходять через Outlet context.
export default function Settings() {
  const { t, language, setLanguage } = useI18n()
  const { onLogout, themeMode, onSetThemeMode, paletteStyle, onSetPaletteStyle, palette, onSetPalette } =
    useOutletContext()

  return (
    <div className="settings-page">
      <h2>{t('settings.title')}</h2>

      <section className="settings-section">
        <h3>{t('settings.languageLabel')}</h3>
        <div className="settings-options">
          {['uk', 'en'].map((lang) => (
            <button
              key={lang}
              type="button"
              className={language === lang ? 'settings-option settings-option--active' : 'settings-option'}
              onClick={() => setLanguage(lang)}
            >
              {t(`settings.language.${lang}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.themeLabel')}</h3>
        <div className="settings-options">
          {['light', 'dark'].map((mode) => (
            <button
              key={mode}
              type="button"
              className={themeMode === mode ? 'settings-option settings-option--active' : 'settings-option'}
              onClick={() => onSetThemeMode(mode)}
            >
              {t(`settings.theme.${mode}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.styleLabel')}</h3>
        <div className="settings-options">
          {['pastel', 'vivid'].map((style) => (
            <button
              key={style}
              type="button"
              className={
                paletteStyle === style ? 'settings-option settings-option--active' : 'settings-option'
              }
              onClick={() => onSetPaletteStyle(style)}
            >
              {t(`settings.style.${style}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.paletteLabel')}</h3>
        <div className="settings-palette-grid">
          {PALETTES.map((name) => {
            const [c1, c2] = PALETTE_COLORS[name][paletteStyle]
            return (
              <button
                key={name}
                type="button"
                className={
                  palette === name ? 'settings-swatch settings-swatch--active' : 'settings-swatch'
                }
                onClick={() => onSetPalette(name)}
              >
                <span
                  className="settings-swatch-preview"
                  style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                />
                <span className="settings-swatch-label">{t(`settings.palette.${name}`)}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.logoutSection')}</h3>
        <button type="button" className="settings-logout" onClick={onLogout}>
          {t('settings.logoutButton')}
        </button>
      </section>
    </div>
  )
}
