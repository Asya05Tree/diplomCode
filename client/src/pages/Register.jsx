import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { sendCode, register } from '../api/client'
import CodeInput from '../components/CodeInput'
import AuthControls from '../components/AuthControls'
import FieldHelp from '../components/FieldHelp'
import { OCCUPATIONS, occupationKey, occupationValue } from '../utils/occupation'
import {
  filterNickname,
  filterEmailChars,
  isValidNickname,
  isValidEmailFormat,
  isGmailAddress,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from '../utils/authValidation'
import './AuthForm.css'

const GENDER_OPTIONS = ['female', 'male', 'other']

function errorKeyToMessage(t, error, fallbackKey) {
  const map = {
    invalid_email: 'register.errorGmailRequired',
    invalid_nickname: 'register.errorInvalidNickname',
    email_taken: 'register.errorEmailTaken',
    invalid_code: 'register.errorInvalidCode',
    invalid_password_length: 'register.errorPasswordTooShort',
    consent_required: 'register.errorConsentRequired',
  }
  return t(map[error.message] ?? fallbackKey)
}

export default function Register({ onRegistered, themeMode, onSetThemeMode, palette, onSetPalette }) {
  const { t } = useI18n()
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('female')
  const [studentType, setStudentType] = useState('pupil')
  const [isWorking, setIsWorking] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSendCode = async () => {
    setError('')
    if (!isValidNickname(nickname)) {
      setError(t('register.errorInvalidNickname'))
      return
    }
    if (!isValidEmailFormat(email)) {
      setError(t('register.errorInvalidEmailFormat'))
      return
    }
    if (!isGmailAddress(email)) {
      setError(t('register.errorGmailRequired'))
      return
    }
    setBusy(true)
    try {
      await sendCode(email, nickname)
      setCodeSent(true)
    } catch (err) {
      setError(errorKeyToMessage(t, err, 'register.errorSendCode'))
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(t('register.errorPasswordTooShort'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('register.errorPasswordMismatch'))
      return
    }
    if (!consent) {
      setError(t('register.errorConsentRequired'))
      return
    }
    setBusy(true)
    try {
      const result = await register({ nickname, gender, email, code, password, studentType, isWorking, consentAccepted: consent })
      onRegistered(result)
    } catch (err) {
      setError(errorKeyToMessage(t, err, 'register.errorFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="register-page">
      <div className="auth-floating">
        <AuthControls
          themeMode={themeMode}
          onSetThemeMode={onSetThemeMode}
          palette={palette}
          onSetPalette={onSetPalette}
        />
      </div>

      {/* Ліворуч — бренд і заголовок НАД декоративною картинкою; форма праворуч окремо */}
      <div className="register-left">
        <div className="register-head">
          <span className="register-brand">Всетута</span>
          <h2>{t('register.title')}</h2>
        </div>
        <img src="/images/hero-image.png" alt="" className="register-decor-img" aria-hidden="true" />
      </div>

      <form className="card auth-form auth-form--wide" onSubmit={handleSubmit}>
        <div className="auth-form-cols">
            {/* Колонка 1 — про користувача */}
            <fieldset className="auth-col">
              <legend className="auth-col-title">{t('register.sectionAbout')}</legend>

              <label>
                <span className="field-label">
                  {t('register.nickname')}
                  <FieldHelp text={t('register.nicknameHelp')} label={t('fieldHelp.label')} />
                </span>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(filterNickname(e.target.value))}
                  minLength={2}
                  required
                />
              </label>

              <label>
                <span className="field-label">
                  {t('register.gender')}
                  <FieldHelp text={t('register.genderHelp')} label={t('fieldHelp.label')} />
                </span>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{t(`register.gender.${g}`)}</option>
                  ))}
                </select>
              </label>

              {/* Одна зрозуміла комбінація «навчання + робота» (6 варіантів) замість окремих
                  перемикачів типу навчання та чекбокса «працюю» — так користувач точно бачить,
                  що можна обрати і «школяр + працюю», і «тільки працюю», і «нічого з цього». */}
              <label>
                <span className="field-label">
                  {t('register.occupation')}
                  <FieldHelp text={t('register.occupationHelp')} label={t('fieldHelp.label')} />
                </span>
                <select
                  value={occupationKey(studentType, isWorking)}
                  onChange={(e) => {
                    const v = occupationValue(e.target.value)
                    setStudentType(v.studentType)
                    setIsWorking(v.isWorking)
                  }}
                >
                  {OCCUPATIONS.map(([key]) => (
                    <option key={key} value={key}>{t(`register.occupation.${key}`)}</option>
                  ))}
                </select>
              </label>

              {studentType === 'pupil' && (
                <p className="auth-note">{t('register.pupilNote')}</p>
              )}
            </fieldset>

            {/* Колонка 2 — обліковий запис */}
            <fieldset className="auth-col">
              <legend className="auth-col-title">{t('register.sectionAccount')}</legend>

              <label>
                <span className="field-label">
                  {t('register.email')}
                  <FieldHelp text={t('register.emailHelp')} label={t('fieldHelp.label')} />
                </span>
                <div className="auth-inline">
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(filterEmailChars(e.target.value))}
                    maxLength={EMAIL_MAX_LENGTH}
                    required
                  />
                  <button type="button" onClick={handleSendCode} disabled={busy || !email}>
                    {codeSent ? t('register.codeResend') : t('register.sendCode')}
                  </button>
                </div>
              </label>

              <label>
                <span className="field-label">
                  {t('register.code')}
                  <FieldHelp text={t('register.codeHelp')} label={t('fieldHelp.label')} />
                </span>
                <CodeInput value={code} onChange={setCode} length={6} />
              </label>

              <label>
                <span className="field-label">
                  {t('register.password')}
                  <FieldHelp text={t('register.passwordHelp')} label={t('fieldHelp.label')} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                />
              </label>

              <label>
                <span className="field-label">
                  {t('register.confirmPassword')}
                  <FieldHelp text={t('register.confirmPasswordHelp')} label={t('fieldHelp.label')} />
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                />
              </label>
            </fieldset>
          </div>

          {/* На всю ширину — згода, вікова примітка, помилка, кнопка та посилання */}
          <label className="auth-checkbox">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              {t('register.consentPre')}{' '}
              <Link to="/privacy" target="_blank" rel="noreferrer">{t('legal.privacyTitle')}</Link>
              {' '}{t('register.consentAnd')}{' '}
              <Link to="/terms" target="_blank" rel="noreferrer">{t('legal.termsTitle')}</Link>
              <FieldHelp text={t('register.consentHelp')} label={t('fieldHelp.label')} />
            </span>
          </label>
          <p className="auth-note">{t('register.ageNote')}</p>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={busy}>{t('register.submit')}</button>
          <div className="auth-links-row">
            <Link to="/login" className="auth-link">{t('auth.haveAccount')}</Link>
            <Link to="/" className="auth-link">{t('auth.back')}</Link>
          </div>
        </form>
    </div>
  )
}
