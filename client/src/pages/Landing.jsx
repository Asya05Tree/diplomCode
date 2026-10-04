import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import './Landing.css'

// Демонстраційний набір страв прямо тут (coding-guide.md §10 — та сама ідея
// "масив, що потім ляже на Recipe/RecipeIngredient" стосується і цього прикладу).
// tags відповідають тегам з UserTagPreference (planner-spec.md §3.2): перетин
// тегів страви з активними обмеженнями користувача забирає страву з розгляду.
const DISHES = [
  { key: 'borsch', price: 150, tags: [] },
  { key: 'macaroni', price: 240, tags: ['gluten'] },
  { key: 'mash', price: 100, tags: [] },
  { key: 'salad', price: 230, tags: [] },
  { key: 'apple', price: 25, tags: [] },
  { key: 'juice', price: 148, tags: ['citrus'] },
]

const RESTRICTIONS = [
  { key: 'citrus', tag: 'citrus' },
  { key: 'gluten', tag: 'gluten' },
]

const MIN_MONEY = 0
const MAX_MONEY = 1000
const DEFAULT_MONEY = 1000

function clampMoney(value) {
  if (Number.isNaN(value)) return MIN_MONEY
  return Math.min(MAX_MONEY, Math.max(MIN_MONEY, value))
}

// Публічна сторінка для тих, хто ще не увійшов. Реєстрація/вхід — окремі URL (/reg, /login),
// щоб на них можна було перейти напряму або оновити сторінку без втрати екрана.
export default function Landing() {
  const { t } = useI18n()
  const [money, setMoney] = useState(DEFAULT_MONEY)
  const [activeRestrictions, setActiveRestrictions] = useState([])

  const toggleRestriction = (tag) => {
    setActiveRestrictions((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    )
  }

  const handleMoneyChange = (event) => {
    const raw = event.target.value
    if (raw === '') {
      setMoney('')
      return
    }
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    setMoney(clampMoney(parsed))
  }

  const handleMoneyBlur = () => {
    setMoney((prev) => clampMoney(Number(prev) || 0))
  }

  const allowedDishes = useMemo(
    () => DISHES.filter((dish) => !dish.tags.some((tag) => activeRestrictions.includes(tag))),
    [activeRestrictions],
  )

  // Жорсткий фільтр (обмеження) звужує множину, бюджет — відбирає з неї пари,
  // що вкладаються в суму. Той самий принцип, що й RuleEngine у planner-spec.md §2.3,
  // тільки в мініатюрі й прямо в компоненті, без бекенду.
  const combos = useMemo(() => {
    const budget = clampMoney(Number(money) || 0)
    const result = []
    for (let i = 0; i < allowedDishes.length; i++) {
      for (let j = i + 1; j < allowedDishes.length; j++) {
        const total = allowedDishes[i].price + allowedDishes[j].price
        if (total <= budget) {
          result.push({ items: [allowedDishes[i], allowedDishes[j]], total })
        }
      }
    }
    result.sort((a, b) => b.total - a.total)
    return result
  }, [allowedDishes, money])

  return (
    <div className="landing">
      <header className="landing-header">
        <img src="/images/logo1.png" alt="Logo" className="landing-logo" />
      </header>

      <div className="landing-auth">
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
      </div>

      <section className="landing-demo">
        <h2 className="landing-demo-heading">{t('landing.heroHeading')}</h2>
        <p className="landing-demo-text">{t('landing.heroText')}</p>

        <div className="landing-demo-grid">
          <div className="card landing-panel landing-panel-money">
            <label className="landing-panel-title" htmlFor="landing-money-input">
              {t('landing.moneyLabel')}
            </label>
            <div className="landing-money-field">
              <input
                id="landing-money-input"
                type="number"
                inputMode="numeric"
                min={MIN_MONEY}
                max={MAX_MONEY}
                step={1}
                value={money}
                onChange={handleMoneyChange}
                onBlur={handleMoneyBlur}
              />
              <span className="landing-money-currency">{t('landing.moneyCurrency')}</span>
            </div>
            <p className="landing-panel-hint">{t('landing.moneyHint')}</p>
          </div>

          <div className="card landing-panel landing-panel-restrictions">
            <p className="landing-panel-title">{t('landing.restrictionsLabel')}</p>
            <ul className="landing-restrictions-list">
              {RESTRICTIONS.map((restriction) => (
                <li key={restriction.key}>
                  <label className="landing-restriction-option">
                    <input
                      type="checkbox"
                      checked={activeRestrictions.includes(restriction.tag)}
                      onChange={() => toggleRestriction(restriction.tag)}
                    />
                    <span>{t(`landing.restriction.${restriction.key}`)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="card landing-panel landing-panel-food">
            <p className="landing-panel-title">{t('landing.foodLabel')}</p>
            <ul className="landing-food-list">
              {DISHES.map((dish) => (
                <li key={dish.key} className={allowedDishes.includes(dish) ? '' : 'is-disabled'}>
                  <span>{t(`landing.dish.${dish.key}`)}</span>
                  <span className="landing-food-price">
                    {dish.price} {t('landing.moneyCurrency')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card landing-results">
          <p className="landing-panel-title">{t('landing.resultsLabel')}</p>
          {combos.length === 0 ? (
            <p className="placeholder-text">{t('landing.resultsEmpty')}</p>
          ) : (
            <ul className="landing-results-list">
              {combos.map((combo, index) => (
                <li key={combo.items.map((item) => item.key).join('-')}>
                  {index > 0 && <div className="landing-results-divider">{t('landing.resultsOr')}</div>}
                  <div className="landing-results-combo">
                    {t(`landing.dish.${combo.items[0].key}`)} {t('landing.comboJoin')}{' '}
                    {t(`landing.dish.${combo.items[1].key}`)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
