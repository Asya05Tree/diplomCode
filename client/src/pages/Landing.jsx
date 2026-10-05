import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import MonthGrid from '../components/planner/MonthGrid'
import ComboList from '../components/common/ComboList'
import { clamp, findMaximalCombos } from '../utils/combos'
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

const DEMO_TABS = [
  { key: 'food', labelKey: 'landing.demoTab.food' },
  { key: 'shopping', labelKey: 'landing.demoTab.shopping' },
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

// Три приклади повторюваних справ, які всі тримаються ОДНОГО розкладу — того самого,
// що користувач задає для "Їсти сало" (дні тижня або крок у днях). День на календарі
// демонструє, що кілька планів може збігатися в один день (planner-spec.md §4.3).
const RECURRING_TASK_DEFS = [
  { key: 'salo', titleKey: 'landing.recurringTaskTitle', commentKey: 'landing.recurringTaskComment' },
  { key: 'flowers', titleKey: 'landing.recurringTask.flowersTitle', commentKey: 'landing.recurringTask.flowersComment' },
  { key: 'window', titleKey: 'landing.recurringTask.windowTitle', commentKey: 'landing.recurringTask.windowComment' },
]

// Рядок вкладок — спільний вигляд для перемикача демо (їжа / покупки) і для
// перемикача типу повторення нижче.
function TabBar({ tabs, activeKey, onSelect, t }) {
  return (
    <div className="landing-tabs-bar">
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

// Чи припадає спільний розклад (дні тижня або крок у днях) на вказаний день (не раніше today).
function occursOnDate(date, today, repeatType, selectedWeekDays, intervalDays) {
  const diffDays = Math.round((startOfDay(date) - today) / 86400000)
  if (diffDays < 0) return false
  if (repeatType === 'EveryNDays') return diffDays % intervalDays === 0
  return selectedWeekDays.has(isoDayOfWeek(date))
}

// Публічна сторінка для тих, хто ще не увійшов. Реєстрація/вхід — окремі URL (/reg, /login),
// щоб на них можна було перейти напряму або оновити сторінку без втрати екрана.
export default function Landing() {
  const { t } = useI18n()

  const [activeDemo, setActiveDemo] = useState('food')

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
  const [selectedDate, setSelectedDate] = useState(null)

  const handleMonthChange = (nextMonth) => {
    if (nextMonth < minMonth || nextMonth > maxMonth) return
    setVisibleMonth(nextMonth)
  }

  // Поза межами "сьогодні..+3 місяці" день не можна обрати — так само, як і сітка не гортається далі
  const handleSelectDate = (date) => {
    if (date < today || date > recurrenceEndDate) return
    setSelectedDate(date)
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
      if (occursOnDate(date, today, repeatType, selectedWeekDays, intervalDays)) {
        map.set(toApiDate(date), 'occurrence')
      }
    }
    return map
  }, [repeatType, selectedWeekDays, intervalDays, today, recurrenceEndDate])

  // Усі три плани тримаються одного розкладу, тож на обраний день вони або всі є, або жодного
  const selectedDayHasPlans =
    selectedDate != null && occursOnDate(selectedDate, today, repeatType, selectedWeekDays, intervalDays)

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

        <div className="landing-demo-switch">
          <TabBar tabs={DEMO_TABS} activeKey={activeDemo} onSelect={setActiveDemo} t={t} />
        </div>

        {activeDemo === 'food' && (
          <>
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
          </>
        )}

        {activeDemo === 'shopping' && (
          <>
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
          </>
        )}
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

            <div className="landing-day-plan">
              {selectedDate ? (
                <>
                  <p className="landing-day-plan-date">{toApiDate(selectedDate)}</p>
                  {selectedDayHasPlans ? (
                    <ul className="landing-day-plan-list">
                      {RECURRING_TASK_DEFS.map((task) => (
                        <li key={task.key} className="landing-day-plan-item">
                          <span className="landing-recurring-task-title">{t(task.titleKey)}</span>
                          <span className="landing-recurring-task-comment">{t(task.commentKey)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="placeholder-text">{t('landing.recurringDayEmpty')}</p>
                  )}
                </>
              ) : (
                <p className="placeholder-text">{t('landing.recurringDayHint')}</p>
              )}
            </div>
          </div>

          <div className="card landing-panel landing-recurring-calendar">
            <MonthGrid
              visibleMonth={visibleMonth}
              onMonthChange={handleMonthChange}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              markings={recurringMarkings}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
