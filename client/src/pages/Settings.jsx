import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useI18n } from '../i18n'
import { PALETTES, PALETTE_COLORS, DATE_FORMATS, TIME_FORMATS } from '../utils/settings'
import { formatDateFor, clockFor } from '../utils/date'
import { exportData, wipeData, deleteAccount } from '../api/account'
import Icon from '../components/Icon'
import './Settings.css'

// Зразкова дата для прев'ю формату — день (9) і місяць (3) різні, рік окремий, тож порядок
// елементів видно однозначно (planner-spec.md §4.10).
const SAMPLE_DATE = new Date(2026, 2, 9)
const ISO_WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7]

// Налаштування (planner-spec.md §4.10): мова, тема, акцентна палітра й вихід з акаунта.
// Тема/стиль/палітра підняті в App.jsx (застосовуються до всього додатку через
// data-* атрибути на кореневому div), тому сюди приходять через Outlet context.
export default function Settings() {
  const { t, language, setLanguage, weekStart, setWeekStart, dateFormat, setDateFormat, timeFormat, setTimeFormat, weekdaysIso } = useI18n()
  const {
    onLogout, themeMode, onSetThemeMode, paletteStyle, onSetPaletteStyle, palette, onSetPalette,
    studentType, isWorking, onSetStudyStatus, gender, onSetGender,
  } = useOutletContext()

  const STUDENT_TYPES = ['pupil', 'student', 'none']
  const GENDER_OPTIONS = ['female', 'male', 'other']

  // --- Акаунт і дані: експорт, видалення даних, видалення акаунта ---
  const [exporting, setExporting] = useState(false)
  const [confirm, setConfirm] = useState(null) // null | 'wipe' | 'delete'
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [accountNote, setAccountNote] = useState('')

  const handleExport = async () => {
    setExporting(true)
    setAccountError('')
    try {
      await exportData()
    } catch {
      setAccountError(t('settings.account.exportError'))
    } finally {
      setExporting(false)
    }
  }

  const openConfirm = (mode) => {
    setConfirm(mode)
    setPassword('')
    setAccountError('')
  }

  const closeConfirm = () => {
    if (busy) return
    setConfirm(null)
    setPassword('')
    setAccountError('')
  }

  const submitConfirm = async () => {
    if (!password) {
      setAccountError(t('settings.account.passwordRequired'))
      return
    }
    setBusy(true)
    setAccountError('')
    try {
      if (confirm === 'wipe') {
        await wipeData(password)
        setConfirm(null)
        setPassword('')
        setAccountNote(t('settings.account.wipeDone'))
      } else {
        await deleteAccount(password)
        onLogout() // акаунта більше немає — виходимо
      }
    } catch (err) {
      setAccountError(
        err?.message === 'invalid_credentials'
          ? t('settings.account.wrongPassword')
          : t('settings.account.actionError'),
      )
    } finally {
      setBusy(false)
    }
  }

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
              <Icon name={mode === 'light' ? 'sun' : 'moon'} />
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
        <h3>{t('settings.weekStartLabel')}</h3>
        <p className="settings-hint">{t('settings.weekStartHint')}</p>
        <div className="settings-options">
          {ISO_WEEK_DAYS.map((day) => (
            <button
              key={day}
              type="button"
              className={weekStart === day ? 'settings-option settings-option--active' : 'settings-option'}
              onClick={() => setWeekStart(day)}
            >
              {weekdaysIso[day - 1]}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.dateFormatLabel')}</h3>
        <div className="settings-options">
          {DATE_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              className={
                dateFormat === format
                  ? 'settings-option settings-option--stacked settings-option--active'
                  : 'settings-option settings-option--stacked'
              }
              onClick={() => setDateFormat(format)}
            >
              <span className="settings-option-title">{t(`settings.dateFormat.${format}`)}</span>
              <span className="settings-option-example">{formatDateFor(SAMPLE_DATE, format)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.timeFormatLabel')}</h3>
        <div className="settings-options">
          {TIME_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              className={
                timeFormat === format
                  ? 'settings-option settings-option--stacked settings-option--active'
                  : 'settings-option settings-option--stacked'
              }
              onClick={() => setTimeFormat(format)}
            >
              <span className="settings-option-title">{t(`settings.timeFormat.${format}`)}</span>
              <span className="settings-option-example">{clockFor(13, 0, format)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.studyStatusLabel')}</h3>
        <div className="settings-options">
          {STUDENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={studentType === type ? 'settings-option settings-option--active' : 'settings-option'}
              onClick={() => onSetStudyStatus({ studentType: type })}
            >
              {t(`register.studentType.${type}`)}
            </button>
          ))}
        </div>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={Boolean(isWorking)}
            onChange={(e) => onSetStudyStatus({ isWorking: e.target.checked })}
          />
          {t('register.working')}
        </label>
      </section>

      <section className="settings-section">
        <h3>{t('settings.genderLabel')}</h3>
        <div className="settings-options">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              className={gender === g ? 'settings-option settings-option--active' : 'settings-option'}
              onClick={() => onSetGender(g)}
            >
              {t(`register.gender.${g}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.logoutSection')}</h3>
        <button type="button" className="settings-logout" onClick={onLogout}>
          <Icon name="arrow-right" />
          {t('settings.logoutButton')}
        </button>
      </section>

      <section className="settings-section">
        <h3>{t('settings.account.title')}</h3>
        <p className="settings-hint">{t('settings.account.exportHint')}</p>
        <div className="settings-account-actions">
          <button type="button" className="settings-account-btn" onClick={handleExport} disabled={exporting}>
            <Icon name="download" />
            {exporting ? t('settings.account.exporting') : t('settings.account.export')}
          </button>
          {accountNote && <span className="settings-account-note">{accountNote}</span>}
        </div>

        <div className="settings-danger">
          <p className="settings-danger-title">{t('settings.account.dangerZone')}</p>
          <div className="settings-account-actions">
            <button type="button" className="settings-danger-btn" onClick={() => openConfirm('wipe')}>
              <Icon name="trash" />
              {t('settings.account.wipe')}
            </button>
            <button type="button" className="settings-danger-btn settings-danger-btn--strong" onClick={() => openConfirm('delete')}>
              <Icon name="trash" />
              {t('settings.account.delete')}
            </button>
          </div>
          <p className="settings-hint">{t('settings.account.wipeHint')}</p>
        </div>
      </section>

      {confirm && (
        <div className="settings-modal-backdrop" onClick={closeConfirm}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirm === 'wipe' ? t('settings.account.wipe') : t('settings.account.delete')}</h3>
            <p className="settings-modal-text">
              {confirm === 'wipe' ? t('settings.account.wipeConfirm') : t('settings.account.deleteConfirm')}
            </p>
            <label className="settings-modal-label">
              {t('settings.account.passwordLabel')}
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitConfirm()}
              />
            </label>
            {accountError && <p className="settings-modal-error">{accountError}</p>}
            <div className="settings-modal-actions">
              <button type="button" className="btn-ghost" onClick={closeConfirm} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button type="button" className="settings-danger-btn settings-danger-btn--strong" onClick={submitConfirm} disabled={busy}>
                {busy ? t('settings.account.working') : t('settings.account.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
