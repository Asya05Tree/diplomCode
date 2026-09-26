import { useI18n } from '../i18n'
import './Landing.css'

// Публічна сторінка для тих, хто ще не увійшов. Клік по картинці переключає вид у App.jsx —
// окремого роутера в проекті немає, і тягнути його заради 4 екранів не варто (coding-guide.md §1).
export default function Landing({ onNavigate }) {
  const { t } = useI18n()

  return (
    <div className="landing">
      <header className="landing-header">
        <img src="/images/logo1.png" alt="Logo" className="landing-logo" />
      </header>

      <div className="landing-main">
        <div className="landing-choices">
          <button type="button" className="landing-choice" onClick={() => onNavigate('register')}>
            <span className="landing-choice-visual">
              <span className="landing-choice-label">{t('landing.register')}</span>
              <img src="/images/left.png" alt={t('landing.register')} className="landing-choice-image" />
            </span>
          </button>
          <button type="button" className="landing-choice" onClick={() => onNavigate('login')}>
            <span className="landing-choice-visual">
              <span className="landing-choice-label">{t('landing.login')}</span>
              <img src="/images/right.png" alt={t('landing.login')} className="landing-choice-image" />
            </span>
          </button>
        </div>

        <div className="card landing-placeholder">
          <h2>{t('landing.title')}</h2>
          <p className="placeholder-text">{t('landing.subtitle')}</p>
        </div>
      </div>
    </div>
  )
}
