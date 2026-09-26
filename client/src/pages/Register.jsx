import { useState } from 'react'
import { useI18n } from '../i18n'
import { sendCode, register } from '../api/client'
import './AuthForm.css'

const GENDER_OPTIONS = ['female', 'male', 'other']

export default function Register({ onRegistered, onBack }) {
  const { t } = useI18n()
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('female')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSendCode = async () => {
    setError('')
    if (!email.includes('@')) {
      setError(t('register.errorInvalidEmail'))
      return
    }
    setBusy(true)
    try {
      await sendCode(email)
      setCodeSent(true)
    } catch {
      setError(t('register.errorSendCode'))
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError(t('register.errorPasswordMismatch'))
      return
    }
    setBusy(true)
    try {
      const result = await register({ nickname, gender, email, code, password })
      onRegistered(result)
    } catch {
      setError(t('register.errorFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-form" onSubmit={handleSubmit}>
        <h2>{t('register.title')}</h2>

        <label>
          {t('register.nickname')}
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} required />
        </label>

        <label>
          {t('register.gender')}
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>{t(`register.gender.${g}`)}</option>
            ))}
          </select>
        </label>

        <label>
          {t('register.email')}
          <div className="auth-inline">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button type="button" onClick={handleSendCode} disabled={busy || !email}>
              {codeSent ? t('register.codeResend') : t('register.sendCode')}
            </button>
          </div>
        </label>

        <label>
          {t('register.code')}
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>

        <label>
          {t('register.password')}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        <label>
          {t('register.confirmPassword')}
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit" disabled={busy}>{t('register.submit')}</button>
        <button type="button" className="auth-link" onClick={onBack}>{t('auth.back')}</button>
      </form>
    </div>
  )
}
