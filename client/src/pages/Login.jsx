import { useState } from 'react'
import { useI18n } from '../i18n'
import { login } from '../api/client'
import './AuthForm.css'

export default function Login({ onLoggedIn, onBack }) {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
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
    <div className="auth-page">
      <form className="card auth-form" onSubmit={handleSubmit}>
        <h2>{t('login.title')}</h2>

        <label>
          {t('login.email')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label>
          {t('login.password')}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit" disabled={busy}>{t('login.submit')}</button>
        <button type="button" className="auth-link" onClick={onBack}>{t('auth.back')}</button>
      </form>
    </div>
  )
}
