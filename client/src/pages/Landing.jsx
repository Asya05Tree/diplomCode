import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import './Landing.css'

// Публічна сторінка для тих, хто ще не увійшов. Реєстрація/вхід — окремі URL (/reg, /login),
// щоб на них можна було перейти напряму або оновити сторінку без втрати екрана.
export default function Landing() {
  const { t } = useI18n()

  return (
    <div className="landing">
      <header className="landing-header">
        <img src="/images/logo1.png" alt="Logo" className="landing-logo" />
      </header>

      <div className="landing-main">
        <div className="landing-choices">
          <Link to="/reg" className="landing-choice">
            <span className="landing-choice-visual">
              <span className="landing-choice-label">{t('landing.register')}</span>
              <img src="/images/left.png" alt={t('landing.register')} className="landing-choice-image" />
            </span>
          </Link>
          <Link to="/login" className="landing-choice">
            <span className="landing-choice-visual">
              <span className="landing-choice-label">{t('landing.login')}</span>
              <img src="/images/right.png" alt={t('landing.login')} className="landing-choice-image" />
            </span>
          </Link>
        </div>

        <div className="card landing-placeholder">
          <h2>{t('landing.title')}</h2>
          <p className="placeholder-text">{t('landing.subtitle')}</p>
        </div>
      </div>
    </div>
  )
}
