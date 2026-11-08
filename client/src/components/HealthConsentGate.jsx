import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import Icon from './Icon'
import './HealthConsentGate.css'

// Екран окремої явної згоди перед модулями «Здоров'я»/«Цикл» (особлива категорія даних, ЗУ №2297-VI
// ст.7). Доки згоди немає — замість вмісту показуємо це пояснення + кнопку згоди. Згода зберігається
// на сервері (UserProfile.HealthConsentAt), тож запит одноразовий.
export default function HealthConsentGate({ consented, onConsent, children }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)

  if (consented) return children

  const accept = async () => {
    setBusy(true)
    try {
      await onConsent()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="consent-gate">
      <div className="consent-card card">
        <Icon name="lock" className="consent-icon" />
        <h2>{t('healthConsent.title')}</h2>
        <p>{t('healthConsent.body')}</p>
        <p className="consent-link">
          <Link to="/privacy">{t('healthConsent.policyLink')}</Link>
        </p>
        <button type="button" className="consent-accept" onClick={accept} disabled={busy}>
          {t('healthConsent.accept')}
        </button>
      </div>
    </div>
  )
}
