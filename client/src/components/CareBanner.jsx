import { useI18n } from '../i18n'
import Icon from './Icon'
import './CareBanner.css'

// Мʼяке нагадування про відпочинок у "важкі дні" (дні менструації). Показується лише коли
// користувачка увімкнула "знижувати навантаження у важкі дні" (Цикл → налаштування, §3.7):
// сам прапорець не змінює дані — він керує появою цієї турботливої підказки й натяку
// "запланувати менше". Рішення завжди лишається за людиною.
export default function CareBanner() {
  const { t } = useI18n()
  return (
    <div className="care-banner" role="note">
      <Icon name="heart" className="care-banner-icon" />
      <div className="care-banner-body">
        <span className="care-banner-title">{t('cycle.careTitle')}</span>
        <span className="care-banner-text">{t('cycle.careText')}</span>
        <span className="care-banner-hint">{t('cycle.carePlanLess')}</span>
      </div>
    </div>
  )
}
