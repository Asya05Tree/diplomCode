import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import './Landing.css'

// Демонстраційний набір страв прямо тут (coding-guide.md §10 — та сама ідея
// "масив, що потім ляже на Recipe/RecipeIngredient" стосується і цього прикладу).
// tags відповідають тегам з UserTagPreference (planner-spec.md §3.2): перетин
// тегів страви з активними обмеженнями користувача забирає страву з розгляду.
const DISHES = [
  { key: 'borsch', price: 150, tags: ['meat'] },
  { key: 'macaroni', price: 240, tags: ['gluten'] },
  { key: 'mash', price: 100, tags: ['lactose'] },
  { key: 'salad', price: 230, tags: [] },
  { key: 'apple', price: 25, tags: [] },
  { key: 'juice', price: 148, tags: ['citrus'] },
]

const FOOD_RESTRICTIONS = [
  { key: 'citrus', tag: 'citrus' },
  { key: 'gluten', tag: 'gluten' },
  { key: 'lactose', tag: 'lactose' },
  { key: 'meat', tag: 'meat' },
]

// Другий приклад того самого механізму — "Запаси" з planner-spec.md §3.4:
// користувач відмічає чекбоксами, що вже є дома, це знімає позицію зі списку покупок.
const PURCHASE_ITEMS = [
  { key: 'toiletCleaner', price: 220, qty: 1 },
  { key: 'eggs', price: 70, qty: 10 },
  { key: 'toothpaste', price: 110, qty: 1 },
  { key: 'dumplings', price: 110, qty: 1 },
  { key: 'iceCream', price: 44, qty: 1 },
]

// Завжди показані зверху списку наявного — не чекбокси, ні на що не впливають,
// лише контекст (у людини вдома є й інші речі, не тільки ті, що в каталозі).
const EXTRA_STOCK_ITEMS = [
  { key: 'apple', qty: 2 },
  { key: 'oil', qty: 1 },
]

const FOOD_MONEY_MIN = 0
const FOOD_MONEY_MAX = 1000
const FOOD_MONEY_DEFAULT = 1000

const SHOPPING_MONEY_MIN = 0
const SHOPPING_MONEY_MAX = 600
const SHOPPING_MONEY_DEFAULT = 600

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

// Пари позицій, сума яких вкладається в бюджет — спільна функція для обох демо-блоків:
// жорсткий фільтр (обмеження / "вже є дома") звужує множину, бюджет відбирає з неї пари.
function findAffordablePairs(items, budget) {
  const result = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const total = items[i].price + items[j].price
      if (total <= budget) {
        result.push({ items: [items[i], items[j]], total })
      }
    }
  }
  result.sort((a, b) => b.total - a.total)
  return result
}

function ComboList({ combos, t, nameFor, emptyText }) {
  if (combos.length === 0) {
    return <p className="placeholder-text">{emptyText}</p>
  }
  return (
    <ul className="landing-results-list">
      {combos.map((combo, index) => (
        <li key={combo.items.map((item) => item.key).join('-')}>
          {index > 0 && <div className="landing-results-divider">{t('landing.resultsOr')}</div>}
          <div className="landing-results-combo">
            {nameFor(combo.items[0])} {t('landing.comboJoin')} {nameFor(combo.items[1])}
          </div>
        </li>
      ))}
    </ul>
  )
}

// Публічна сторінка для тих, хто ще не увійшов. Реєстрація/вхід — окремі URL (/reg, /login),
// щоб на них можна було перейти напряму або оновити сторінку без втрати екрана.
export default function Landing() {
  const { t } = useI18n()

  const [foodMoney, setFoodMoney] = useState(FOOD_MONEY_DEFAULT)
  const [activeDietRestrictions, setActiveDietRestrictions] = useState([])

  const [shoppingMoney, setShoppingMoney] = useState(SHOPPING_MONEY_DEFAULT)
  const [ownedItems, setOwnedItems] = useState([])

  const toggleDietRestriction = (tag) => {
    setActiveDietRestrictions((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    )
  }

  const toggleOwnedItem = (key) => {
    setOwnedItems((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
  }

  const makeMoneyHandlers = (setValue, min, max) => ({
    onChange: (event) => {
      const raw = event.target.value
      if (raw === '') {
        setValue('')
        return
      }
      const parsed = Number(raw)
      if (Number.isNaN(parsed)) return
      setValue(clamp(parsed, min, max))
    },
    onBlur: () => setValue((prev) => clamp(Number(prev) || 0, min, max)),
  })

  const foodMoneyHandlers = makeMoneyHandlers(setFoodMoney, FOOD_MONEY_MIN, FOOD_MONEY_MAX)
  const shoppingMoneyHandlers = makeMoneyHandlers(setShoppingMoney, SHOPPING_MONEY_MIN, SHOPPING_MONEY_MAX)

  const allowedDishes = useMemo(
    () => DISHES.filter((dish) => !dish.tags.some((tag) => activeDietRestrictions.includes(tag))),
    [activeDietRestrictions],
  )

  const dishCombos = useMemo(() => {
    const budget = clamp(Number(foodMoney) || 0, FOOD_MONEY_MIN, FOOD_MONEY_MAX)
    return findAffordablePairs(allowedDishes, budget)
  }, [allowedDishes, foodMoney])

  const neededPurchaseItems = useMemo(
    () => PURCHASE_ITEMS.filter((item) => !ownedItems.includes(item.key)),
    [ownedItems],
  )

  const purchaseCombos = useMemo(() => {
    const budget = clamp(Number(shoppingMoney) || 0, SHOPPING_MONEY_MIN, SHOPPING_MONEY_MAX)
    return findAffordablePairs(neededPurchaseItems, budget)
  }, [neededPurchaseItems, shoppingMoney])

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
          <div className="card landing-panel">
            <label className="landing-panel-title" htmlFor="landing-food-money">
              {t('landing.moneyLabel')}
            </label>
            <div className="landing-money-field">
              <input
                id="landing-food-money"
                type="number"
                inputMode="numeric"
                min={FOOD_MONEY_MIN}
                max={FOOD_MONEY_MAX}
                step={1}
                value={foodMoney}
                {...foodMoneyHandlers}
              />
              <span className="landing-money-currency">{t('landing.moneyCurrency')}</span>
            </div>
            <p className="landing-panel-hint">{t('landing.moneyHint')}</p>
          </div>

          <div className="card landing-panel">
            <p className="landing-panel-title">{t('landing.restrictionsLabel')}</p>
            <ul className="landing-check-list">
              {FOOD_RESTRICTIONS.map((restriction) => (
                <li key={restriction.key}>
                  <label className="landing-check-option">
                    <input
                      type="checkbox"
                      checked={activeDietRestrictions.includes(restriction.tag)}
                      onChange={() => toggleDietRestriction(restriction.tag)}
                    />
                    <span>{t(`landing.restriction.${restriction.key}`)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="card landing-panel">
            <p className="landing-panel-title">{t('landing.foodLabel')}</p>
            <ul className="landing-price-list">
              {DISHES.map((dish) => (
                <li key={dish.key} className={allowedDishes.includes(dish) ? '' : 'is-disabled'}>
                  <span>{t(`landing.dish.${dish.key}`)}</span>
                  <span className="landing-price-amount">
                    {dish.price} {t('landing.moneyCurrency')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card landing-panel">
            <p className="landing-panel-title">{t('landing.resultsLabel')}</p>
            <ComboList
              combos={dishCombos}
              t={t}
              nameFor={(item) => t(`landing.dish.${item.key}`)}
              emptyText={t('landing.resultsEmpty')}
            />
          </div>
        </div>
      </section>

      <section className="landing-demo">
        <h2 className="landing-demo-heading">{t('landing.shoppingHeading')}</h2>
        <p className="landing-demo-text">{t('landing.shoppingText')}</p>

        <div className="landing-demo-grid">
          <div className="card landing-panel">
            <label className="landing-panel-title" htmlFor="landing-shopping-money">
              {t('landing.moneyLabel')}
            </label>
            <div className="landing-money-field">
              <input
                id="landing-shopping-money"
                type="number"
                inputMode="numeric"
                min={SHOPPING_MONEY_MIN}
                max={SHOPPING_MONEY_MAX}
                step={1}
                value={shoppingMoney}
                {...shoppingMoneyHandlers}
              />
              <span className="landing-money-currency">{t('landing.moneyCurrency')}</span>
            </div>
            <p className="landing-panel-hint">{t('landing.shoppingMoneyHint')}</p>
          </div>

          <div className="card landing-panel">
            <p className="landing-panel-title">{t('landing.ownedItemsLabel')}</p>
            <ul className="landing-check-list">
              {EXTRA_STOCK_ITEMS.map((item) => (
                <li key={item.key} className="landing-extra-item">
                  <span>{t(`landing.item.${item.key}`)}</span>
                  <span className="landing-extra-item-qty">
                    {item.qty} {t('landing.unitPieces')}
                  </span>
                </li>
              ))}
              {PURCHASE_ITEMS.map((item) => (
                <li key={item.key}>
                  <label className="landing-check-option">
                    <input
                      type="checkbox"
                      checked={ownedItems.includes(item.key)}
                      onChange={() => toggleOwnedItem(item.key)}
                    />
                    <span>{t(`landing.item.${item.key}`)}</span>
                    <span className="landing-check-option-qty">
                      {item.qty} {t('landing.unitPieces')}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="card landing-panel">
            <p className="landing-panel-title">{t('landing.catalogLabel')}</p>
            <ul className="landing-price-list">
              {PURCHASE_ITEMS.map((item) => (
                <li key={item.key} className={ownedItems.includes(item.key) ? 'is-disabled' : ''}>
                  <span>{t(`landing.item.${item.key}`)}</span>
                  <span className="landing-price-amount">
                    {item.price} {t('landing.moneyCurrency')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card landing-panel">
            <p className="landing-panel-title">{t('landing.possiblePurchasesLabel')}</p>
            <ComboList
              combos={purchaseCombos}
              t={t}
              nameFor={(item) => t(`landing.item.${item.key}`)}
              emptyText={t('landing.shoppingResultsEmpty')}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
