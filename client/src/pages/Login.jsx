import { useState } from 'react'
import { useI18n } from '../i18n'
import { login } from '../api/client'
import { filterEmailChars, isValidEmailFormat, EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '../utils/authValidation'
import './AuthForm.css'
import './Login.css'

export default function Login({ onLoggedIn, onBack }) {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Обидва поля непорожні — картинка "стоп" плавно змінюється на "вперед"
  const bothFieldsFilled = email.length > 0 && password.length > 0

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!isValidEmailFormat(email)) {
      setError(t('login.errorInvalidEmailFormat'))
      return
    }
    setBusy(true)
    try {
      const result = await login(email, password)
      onLoggedIn(result)
    } catch {
      setError(t('login.errorFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-side">
        <form className="card auth-form" onSubmit={handleSubmit}>
          <h2>{t('login.title')}</h2>

          <label>
            {t('login.email')}
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(filterEmailChars(e.target.value))}
              maxLength={EMAIL_MAX_LENGTH}
              required
            />
          </label>

          <label>
            {t('login.password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
              maxLength={PASSWORD_MAX_LENGTH}
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={busy}>{t('login.submit')}</button>
          <button type="button" className="auth-link" onClick={onBack}>{t('auth.back')}</button>
        </form>
      </div>

      <div className="login-side">
        <div className={bothFieldsFilled ? 'login-image-wrap login-image-wrap--go' : 'login-image-wrap'}>
          <img src="/images/stop.png" alt="" className="login-image login-image--stop" />
          <img src="/images/go.png" alt="" className="login-image login-image--go" />
        </div>
      </div>
    </div>
  )
}
