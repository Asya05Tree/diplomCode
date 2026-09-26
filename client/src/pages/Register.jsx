import { useState } from 'react'
import { useI18n } from '../i18n'
import { sendCode, register } from '../api/client'
import CodeInput from '../components/CodeInput'
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
  }
  return t(map[error.message] ?? fallbackKey)
}

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
    setBusy(true)
    try {
      const result = await register({ nickname, gender, email, code, password })
      onRegistered(result)
    } catch (err) {
      setError(errorKeyToMessage(t, err, 'register.errorFailed'))
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
          <input
            value={nickname}
            onChange={(e) => setNickname(filterNickname(e.target.value))}
            minLength={2}
            required
          />
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
            <input
              type="email"
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
          {t('register.code')}
          <CodeInput value={code} onChange={setCode} length={6} />
        </label>

        <label>
          {t('register.password')}
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

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit" disabled={busy}>{t('register.submit')}</button>
        <button type="button" className="auth-link" onClick={onBack}>{t('auth.back')}</button>
      </form>
    </div>
  )
}
