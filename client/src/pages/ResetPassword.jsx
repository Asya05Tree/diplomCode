import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { forgotPassword, resetPassword } from '../api/client'
import CodeInput from '../components/CodeInput'
import AuthControls from '../components/AuthControls'
import {
  filterEmailChars, isValidEmailFormat, isGmailAddress, EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH,
} from '../utils/authValidation'
import './AuthForm.css'

// Відновлення пароля: email → код на пошту → новий пароль. Той самий механізм коду, що в реєстрації.
function errorKeyToMessage(t, error, fallbackKey) {
  const map = {
    invalid_email: 'register.errorGmailRequired',
    invalid_code: 'register.errorInvalidCode',
    invalid_password_length: 'register.errorPasswordTooShort',
  }
  return t(map[error.message] ?? fallbackKey)
}

export default function ResetPassword({ themeMode, onSetThemeMode, palette, onSetPalette }) {
  const { t } = useI18n()
  const controls = (
    <div className="auth-floating">
      <AuthControls
        themeMode={themeMode}
        onSetThemeMode={onSetThemeMode}
        palette={palette}
        onSetPalette={onSetPalette}
      />
    </div>
  )
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSendCode = async () => {
    setError('')
    if (!isValidEmailFormat(email)) { setError(t('register.errorInvalidEmailFormat')); return }
    if (!isGmailAddress(email)) { setError(t('register.errorGmailRequired')); return }
    setBusy(true)
    try {
      await forgotPassword(email)
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
    if (password.length < PASSWORD_MIN_LENGTH) { setError(t('register.errorPasswordTooShort')); return }
    if (password !== confirmPassword) { setError(t('register.errorPasswordMismatch')); return }
    setBusy(true)
    try {
      await resetPassword(email, code, password)
      setDone(true)
    } catch (err) {
      setError(errorKeyToMessage(t, err, 'register.errorFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="auth-page">
        {controls}
        <div className="card auth-form">
          <h2>{t('reset.title')}</h2>
          <p className="auth-note">{t('reset.done')}</p>
          <Link to="/login" className="auth-submit" style={{ textAlign: 'center', textDecoration: 'none' }}>
            {t('reset.backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      {controls}
      <form className="card auth-form" onSubmit={handleSubmit}>
        <h2>{t('reset.title')}</h2>
        <p className="auth-note">{t('reset.subtitle')}</p>

        <label>
          {t('register.email')}
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

        {codeSent && (
          <>
            <label>
              {t('register.code')}
              <CodeInput value={code} onChange={setCode} length={6} />
            </label>

            <label>
              {t('reset.newPassword')}
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
              {t('register.confirmPassword')}
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                required
              />
            </label>
          </>
        )}

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit" disabled={busy || !codeSent}>{t('reset.submit')}</button>
        <Link to="/login" className="auth-link">{t('auth.haveAccount')}</Link>
      </form>
    </div>
  )
}
