import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import './Footer.css'

// Підвал застосунку з юридичними посиланнями (раніше їх ніде не було — вимога ст.8/12 ЗУ №2297-VI:
// суб'єкт даних має мати доступ до політики). Рендериться під вмістом усіх сторінок /app.
export default function Footer() {
  const { t } = useI18n()
  return (
    <footer className="app-footer">
      <nav className="app-footer-links">
        <Link to="/privacy">{t('legal.privacyTitle')}</Link>
        <Link to="/terms">{t('legal.termsTitle')}</Link>
      </nav>
      <span className="app-footer-note">{t('legal.footerNote')}</span>
    </footer>
  )
}
