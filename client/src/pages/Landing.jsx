import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import MonthGrid from '../components/planner/MonthGrid'
import { addDays, addMonths, isoDayOfWeek, startOfDay, toApiDate } from '../utils/date'
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

const FOOD_TABS = [
  { key: 'money', labelKey: 'landing.tab.money', captionKey: 'landing.tabCaption.foodMoney' },
  { key: 'restrictions', labelKey: 'landing.tab.restrictions', captionKey: 'landing.tabCaption.foodRestrictions' },
  { key: 'dishes', labelKey: 'landing.tab.dishes', captionKey: 'landing.tabCaption.foodDishes' },
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
  { key: 'ibuprofen', qty: 1 },
]

const SHOPPING_TABS = [
  { key: 'money', labelKey: 'landing.tab.money', captionKey: 'landing.tabCaption.shoppingMoney' },
  { key: 'owned', labelKey: 'landing.tab.owned', captionKey: 'landing.tabCaption.shoppingOwned' },
  { key: 'purchases', labelKey: 'landing.tab.purchases', captionKey: 'landing.tabCaption.shoppingPurchases' },
]

const FOOD_MONEY_MIN = 0
const FOOD_MONEY_MAX = 1000
const FOOD_MONEY_DEFAULT = 1000

const SHOPPING_MONEY_MIN = 0
const SHOPPING_MONEY_MAX = 600
const SHOPPING_MONEY_DEFAULT = 600

const REPEAT_TYPES = ['WeekCycle', 'EveryNDays']
const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]
const DEFAULT_RECURRING_WEEKDAYS = [1, 3, 5]
const RECURRING_MONTHS_AHEAD = 3

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

// Усі набори позицій (будь-якого розміру — 1, 2, 3 і більше), сума яких вкладається
// в бюджет і до яких не можна додати ще хоч одну позицію без перевищення бюджету.
// Показуємо тільки такі "максимальні" набори: якщо набір можна доповнити — його
// витісняє більший набір, що вже охоплює той самий варіант. Жорсткий фільтр
// (обмеження / "вже є дома") звужує множину заздалегідь, бюджет відбирає з неї набори.
function findMaximalCombos(items, budget) {
  const n = items.length
  const results = []
  for (let mask = 1; mask < 1 << n; mask++) {
    let total = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) total += items[i].price
    }
    if (total > budget) continue

    let canAddMore = false
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i)) && total + items[i].price <= budget) {
        canAddMore = true
        break
      }
    }
    if (canAddMore) continue

    results.push({ items: items.filter((_, i) => mask & (1 << i)), total })
  }
  results.sort((a, b) => b.total - a.total || b.items.length - a.items.length)
  return results
}

function ComboList({ combos, t, nameFor, emptyText }) {
  if (combos.length === 0) {
    return <p className="placeholder-text">{emptyText}</p>
  }
  return (
    <ul className="landing-results-list">
      {combos.map((combo, index) => {
        const parts = []
        combo.items.forEach((item, itemIndex) => {
          if (itemIndex > 0) {
            parts.push(
              <span key={`plus-${item.key}`} className="landing-results-plus">
                +
              </span>,
            )
          }
          parts.push(
            <span key={item.key} className="landing-results-combo-item">
              {nameFor(item)}
            </span>,
          )
        })
        return (
          <li key={combo.items.map((item) => item.key).join('-')}>
            {index > 0 && <div className="landing-results-divider">{t('landing.resultsOr')}</div>}
            <div className="landing-results-combo">{parts}</div>
          </li>
        )
      })}
    </ul>
  )
}

// Рядок вкладок — спільний вигляд для обох демо-блоків їжі/покупок і для перемикача
// типу повторення нижче. variant лише змінює колір активної вкладки (coding-guide.md §5 —
// той самий принцип закріплення кольору за категорією, тут неформально).
function TabBar({ tabs, activeKey, onSelect, t, variant }) {
  return (
    <div className={variant ? `landing-tabs-bar landing-tabs-bar--${variant}` : 'landing-tabs-bar'}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={tab.key === activeKey ? 'landing-tab landing-tab--active' : 'landing-tab'}
          onClick={() => onSelect(tab.key)}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  )
}

// Публічна сторінка для тих, хто ще не увійшов. Реєстрація/вхід — окремі URL (/reg, /login),
// щоб на них можна було перейти напряму або оновити сторінку без втрати екрана.
export default function Landing() {
  const { t } = useI18n()

  const [foodTab, setFoodTab] = useState('money')
  const [foodMoney, setFoodMoney] = useState(FOOD_MONEY_DEFAULT)
  const [activeDietRestrictions, setActiveDietRestrictions] = useState([])

  const [shoppingTab, setShoppingTab] = useState('money')
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
    return findMaximalCombos(allowedDishes, budget)
  }, [allowedDishes, foodMoney])

  const neededPurchaseItems = useMemo(
    () => PURCHASE_ITEMS.filter((item) => !ownedItems.includes(item.key)),
    [ownedItems],
  )

  const purchaseCombos = useMemo(() => {
    const budget = clamp(Number(shoppingMoney) || 0, SHOPPING_MONEY_MIN, SHOPPING_MONEY_MAX)
    return findMaximalCombos(neededPurchaseItems, budget)
  }, [neededPurchaseItems, shoppingMoney])

  const activeFoodTab = FOOD_TABS.find((tab) => tab.key === foodTab) ?? FOOD_TABS[0]
  const activeShoppingTab = SHOPPING_TABS.find((tab) => tab.key === shoppingTab) ?? SHOPPING_TABS[0]

  // Демонстрація повторюваного планування (planner-spec.md §3.3/§4.3): подія діє рівно
  // від сьогодні до сьогодні+3 місяці, без ручного керування межами — так само, як
  // RecurrenceFields пропонує 3 місяці за замовчуванням, тільки тут це єдиний варіант.
  const today = useMemo(() => startOfDay(new Date()), [])
  const recurrenceEndDate = useMemo(() => addMonths(today, RECURRING_MONTHS_AHEAD), [today])
  const minMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const maxMonth = useMemo(
    () => new Date(recurrenceEndDate.getFullYear(), recurrenceEndDate.getMonth(), 1),
    [recurrenceEndDate],
  )

  const [repeatType, setRepeatType] = useState('WeekCycle')
  const [selectedWeekDays, setSelectedWeekDays] = useState(() => new Set(DEFAULT_RECURRING_WEEKDAYS))
  const [intervalDays, setIntervalDays] = useState(2)
  const [visibleMonth, setVisibleMonth] = useState(minMonth)

  const handleMonthChange = (nextMonth) => {
    if (nextMonth < minMonth || nextMonth > maxMonth) return
    setVisibleMonth(nextMonth)
  }

  const toggleWeekDay = (day) => {
    setSelectedWeekDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  const recurringMarkings = useMemo(() => {
    const map = new Map()
    const totalDays = Math.round((recurrenceEndDate - today) / 86400000)
    for (let i = 0; i <= totalDays; i++) {
      const date = addDays(today, i)
      const occurs =
        repeatType === 'WeekCycle' ? selectedWeekDays.has(isoDayOfWeek(date)) : i % intervalDays === 0
      if (occurs) map.set(toApiDate(date), 'occurrence')
    }
    return map
  }, [repeatType, selectedWeekDays, intervalDays, today, recurrenceEndDate])

  const weekdayLabels = t('planner.weekdaysShort').split(',')

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

        <div className="card landing-tabs">
          <TabBar tabs={FOOD_TABS} activeKey={foodTab} onSelect={setFoodTab} t={t} variant="food" />
          <p className="landing-tab-caption">{t(activeFoodTab.captionKey)}</p>

          <div className="landing-tab-content">
            {foodTab === 'money' && (
              <div className="landing-panel">
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
              </div>
            )}

            {foodTab === 'restrictions' && (
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
            )}

            {foodTab === 'dishes' && (
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
            )}
          </div>
        </div>

        <div className="card landing-results">
          <p className="landing-panel-title">{t('landing.resultsLabel')}</p>
          <ComboList
            combos={dishCombos}
            t={t}
            nameFor={(item) => t(`landing.dish.${item.key}`)}
            emptyText={t('landing.resultsEmpty')}
          />
        </div>
      </section>

      <section className="landing-demo">
        <h2 className="landing-demo-heading">{t('landing.shoppingHeading')}</h2>
        <p className="landing-demo-text">{t('landing.shoppingText')}</p>

        <div className="card landing-tabs">
          <TabBar tabs={SHOPPING_TABS} activeKey={shoppingTab} onSelect={setShoppingTab} t={t} variant="shopping" />
          <p className="landing-tab-caption">{t(activeShoppingTab.captionKey)}</p>

          <div className="landing-tab-content">
            {shoppingTab === 'money' && (
              <div className="landing-panel">
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
              </div>
            )}

            {shoppingTab === 'owned' && (
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
            )}

            {shoppingTab === 'purchases' && (
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
            )}
          </div>
        </div>

        <div className="card landing-results">
          <p className="landing-panel-title">{t('landing.possiblePurchasesLabel')}</p>
          <ComboList
            combos={purchaseCombos}
            t={t}
            nameFor={(item) => t(`landing.item.${item.key}`)}
            emptyText={t('landing.shoppingResultsEmpty')}
          />
        </div>
      </section>

      <section className="landing-demo">
        <h2 className="landing-demo-heading">{t('landing.recurringHeading')}</h2>
        <p className="landing-demo-text">{t('landing.recurringText')}</p>

        <div className="landing-recurring-grid">
          <div className="card landing-panel landing-recurring-side">
            <div className="landing-recurring-task">
              <span className="landing-recurring-task-title">{t('landing.recurringTaskTitle')}</span>
              <span className="landing-recurring-task-comment">{t('landing.recurringTaskComment')}</span>
            </div>

            <TabBar
              tabs={REPEAT_TYPES.map((type) => ({
                key: type,
                labelKey: type === 'WeekCycle' ? 'landing.repeatType.WeekCycle' : 'recurrence.type.EveryNDays',
              }))}
              activeKey={repeatType}
              onSelect={setRepeatType}
              t={t}
            />

            {repeatType === 'WeekCycle' ? (
              <div className="landing-weekday-row">
                {ISO_WEEKDAYS.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    className={selectedWeekDays.has(day) ? 'landing-weekday landing-weekday--active' : 'landing-weekday'}
                    onClick={() => toggleWeekDay(day)}
                  >
                    {weekdayLabels[idx]}
                  </button>
                ))}
              </div>
            ) : (
              <div className="landing-panel">
                <p className="landing-panel-title">{t('recurrence.intervalDays')}</p>
                <div className="landing-money-field">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(clamp(Number(e.target.value) || 1, 1, 31))}
                  />
                </div>
              </div>
            )}

            <p className="landing-panel-hint">
              {t('landing.recurringRangeHint', { start: toApiDate(today), end: toApiDate(recurrenceEndDate) })}
            </p>
          </div>

          <div className="card landing-panel landing-recurring-calendar">
            <MonthGrid
              visibleMonth={visibleMonth}
              onMonthChange={handleMonthChange}
              selectedDate={null}
              onSelectDate={() => {}}
              markings={recurringMarkings}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
