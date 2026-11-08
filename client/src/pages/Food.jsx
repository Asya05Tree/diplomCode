import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import { getFinance } from '../api/finance'
import { addShoppingItem, getShoppingList } from '../api/shopping'
import {
  getFoodOverview,
  setStockState as apiSetStockState,
  addStockProduct as apiAddStockProduct,
  toggleSelected as apiToggleSelected,
  getWeeklyMenu,
  saveMenuDay,
  getMenuHints,
  productName,
  recipeName,
  tagLabelFrom,
} from '../api/food'
import { addDays, toApiDate, fromApiDate, todayApiDate } from '../utils/date'
import './Food.css'

// Перший день (за налаштуванням weekStart: 1=Пн..7=Нд) тижня, що містить дату refApi ('YYYY-MM-DD').
function startOfWeek(weekStartIso, refApi) {
  const d = fromApiDate(refApi)
  const iso = d.getDay() === 0 ? 7 : d.getDay()
  let diff = iso - weekStartIso
  if (diff < 0) diff += 7
  return toApiDate(addDays(d, -diff))
}

// Коротка мітка дати 'YYYY-MM-DD' → 'DD.MM'.
function ddmm(apiDate) {
  return `${apiDate.slice(8, 10)}.${apiDate.slice(5, 7)}`
}

const STOCK_TOGGLE = [
  { state: 'Available', cls: 'ok' },
  { state: 'RunningLow', cls: 'warn' },
  { state: 'OutOfStock', cls: 'bad' },
]

// Модуль "Їжа" (planner-spec.md §4.6): лента рецептів з фільтрами, запаси з триступеневим
// станом "є / закінчується / немає", обрані страви та підтвердження готовки. Дані тепер із
// бекенда (/api/food/overview): довідники продуктів/рецептів системні, стан — користувацький.
export default function Food() {
  const { t, language, weekdays, weekStart: weekStartSetting } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Довідники й стан, що приходять з overview.
  const [products, setProducts] = useState([])
  const [recipes, setRecipes] = useState([])
  const [stock, setStock] = useState({}) // productId -> state
  const [selected, setSelected] = useState([]) // [recipeId]
  const [restrictions, setRestrictions] = useState([]) // [{tagKey, relation, displayName}]

  // Бюджет на докупівлю — баланс із "Фінансів". Діапазон "від / до" у межах 0..баланс.
  const [balance, setBalance] = useState(0)
  const [range, setRange] = useState({ from: 0, to: 0 })
  const [mode, setMode] = useState('all') // 'all' | 'available'
  const [showExcluded, setShowExcluded] = useState(false) // перемикач «Показати виключені» страви

  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [stockSearch, setStockSearch] = useState('')
  // Три вкладки розділу: "Меню" (план на тиждень), "Страви" і "Запаси".
  const [tab, setTab] = useState('menu') // 'menu' | 'dishes' | 'stock'
  // Тижневе меню за КОНКРЕТНОЮ ДАТОЮ: { 'YYYY-MM-DD': [recipeId] } для видимого тижня. weekStart —
  // перша дата видимого тижня (можна гортати тижні → історія). menuPickDate — дата для пікера страви.
  const [menuByDate, setMenuByDate] = useState({})
  // Підказки для пікера меню: найчастіші страви в цей день тижня + найчастіші взагалі.
  const [menuHints, setMenuHints] = useState({ byWeekday: [], overall: [] })
  const [weekStart, setWeekStart] = useState(() => startOfWeek(weekStartSetting, todayApiDate()))
  // Режим меню: 'plan' — цей і наступний тиждень (планування); 'history' — минулі тижні (лише перегляд).
  const [menuMode, setMenuMode] = useState('plan')
  const [menuPickDate, setMenuPickDate] = useState(null)
  const [menuLoading, setMenuLoading] = useState(false)
  const [stockCat, setStockCat] = useState('all')
  const [stockSort, setStockSort] = useState('default') // 'default' | 'alpha' | 'availability'
  // Id продуктів, що вже є у списку покупок (невідмічені) — щоб не пропонувати додати двічі.
  const [inShopping, setInShopping] = useState(() => new Set())

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getFoodOverview(),
      getFinance().catch(() => ({ balance: 0 })),
      getShoppingList().catch(() => ({ items: [] })),
    ])
      .then(([ov, fin, shop]) => {
        if (cancelled) return
        setProducts(ov.products)
        setRecipes(ov.recipes)
        const sm = {}
        for (const s of ov.stock) sm[s.productId] = s.state
        setStock(sm)
        setSelected(ov.selected)
        setRestrictions(ov.restrictions)
        const bal = Math.round(Number(fin?.balance) || 0)
        setBalance(bal)
        setRange({ from: 0, to: bal })
        setInShopping(new Set((shop.items || []).filter((x) => !x.isChecked && x.productId != null).map((x) => x.productId)))
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const recipeMap = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes])
  const isPresent = (productId) => stock[productId] === 'Available' || stock[productId] === 'RunningLow'
  const tagLabel = (key) => tagLabelFrom(restrictions, key)

  // Наявність інгредієнтів рахуємо на клієнті з поточних запасів — щоб стрічка реагувала на зміни
  // стану без повторного запиту. Ціна докупівлі — сума відомих особистих цін (решта невідома).
  const availability = useMemo(() => {
    const map = {}
    for (const recipe of recipes) {
      const missing = recipe.ingredients
        .filter((ing) => !isPresent(ing.productId))
        .map((ing) => productMap[ing.productId])
        .filter(Boolean)
      const missingCost = missing.reduce((sum, p) => sum + (p.personalPrice || 0), 0)
      map[recipe.id] = {
        missingProducts: missing,
        missingCount: missing.length,
        missingCost,
        isAvailable: missing.length === 0,
      }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, stock, productMap])

  const visibleRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      // Жорстке правило здоровʼя (Forbidden) — страва не показується взагалі (§2.3, §4.6).
      if (recipe.health?.forbidden) return false
      const av = availability[recipe.id]
      if (!av) return false
      if (mode === 'available') return av.isAvailable
      return av.missingCost >= range.from && av.missingCost <= range.to
    })
  }, [recipes, availability, mode, range])

  const visibleIds = useMemo(() => new Set(visibleRecipes.map((r) => r.id)), [visibleRecipes])

  // Виключені страви (для перемикача «Показати виключені», problems.md #6): кожна з короткою
  // причиною, що РЕАЛЬНО спрацювала. Пріоритет: жорстке обмеження здоров'я → бюджет → наявність.
  const excludedRecipes = useMemo(() => {
    return recipes
      .filter((r) => !visibleIds.has(r.id))
      .map((r) => {
        const hs = r.health || {}
        const av = availability[r.id] || {}
        let reason
        if (hs.forbidden) reason = { kind: 'health', tag: hs.forbidden }
        else if (mode === 'available' && !av.isAvailable) reason = { kind: 'stock', n: av.missingCount }
        else reason = { kind: 'budget' }
        return { recipe: r, reason }
      })
  }, [recipes, visibleIds, availability, mode])

  const clamp = (value) => Math.min(Math.max(0, Math.round(Number(value) || 0)), balance)

  const handleRangeFrom = (e) => {
    const from = Math.min(clamp(e.target.value), range.to)
    setRange((prev) => ({ ...prev, from }))
  }

  const handleRangeTo = (e) => {
    const to = Math.max(clamp(e.target.value), range.from)
    setRange((prev) => ({ ...prev, to }))
  }

  const handleStockState = async (productId, state) => {
    setStock((prev) => ({ ...prev, [productId]: state }))
    await apiSetStockState(productId, state)
    // "Немає" — продукт списано: одразу в список покупок (§4.8, один жест — кілька ефектів).
    if (state === 'OutOfStock') {
      await addShoppingItem({ section: 'Groceries', productId })
      setInShopping((prev) => new Set(prev).add(productId))
      return
    }
    // "Закінчується" (жовтий): якщо товару ще немає в списку покупок — питаємо, чи додати.
    if (state === 'RunningLow' && !inShopping.has(productId)) {
      const name = productName(products.find((p) => p.id === productId) || {}, language)
      if (window.confirm(t('food.lowAddConfirm', { name }))) {
        await addShoppingItem({ section: 'Groceries', productId })
        setInShopping((prev) => new Set(prev).add(productId))
      }
    }
  }

  const handleAddStock = async (productId) => {
    setStock((prev) => ({ ...prev, [productId]: 'Available' }))
    await apiAddStockProduct(productId)
  }

  // Сім дат видимого тижня (перша = weekStart, далі +1 день).
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toApiDate(addDays(fromApiDate(weekStart), i))),
    [weekStart],
  )

  // Завантаження меню видимого тижня (і при зміні тижня). Кожна колонка — конкретна дата → історія.
  useEffect(() => {
    let cancelled = false
    setMenuLoading(true)
    getWeeklyMenu(weekDates[0], weekDates[6])
      .then((data) => { if (!cancelled) setMenuByDate(data || {}) })
      .catch(() => { if (!cancelled) setMenuByDate({}) })
      .finally(() => { if (!cancelled) setMenuLoading(false) })
    return () => { cancelled = true }
  }, [weekDates])

  // При відкритті пікера страви на конкретну дату — підтягуємо підказки (що найчастіше в цей день/взагалі).
  useEffect(() => {
    if (menuPickDate == null) return undefined
    let cancelled = false
    getMenuHints(menuPickDate)
      .then((d) => { if (!cancelled) setMenuHints({ byWeekday: d?.byWeekday || [], overall: d?.overall || [] }) })
      .catch(() => { if (!cancelled) setMenuHints({ byWeekday: [], overall: [] }) })
    return () => { cancelled = true }
  }, [menuPickDate])

  // Ліміт страв на один день меню (щоб день не роздувався). Історія не редагується.
  const MAX_MENU_PER_DAY = 6

  // Зберегти день одразу (add/remove/clear — через новий список рецептів дня).
  const saveDay = (date, ids) => {
    setMenuByDate((prev) => ({ ...prev, [date]: ids }))
    saveMenuDay(date, ids).catch(() => {})
  }
  const addToMenu = (date, recipeId) => {
    const cur = menuByDate[date] || []
    if (cur.length >= MAX_MENU_PER_DAY) { setMenuPickDate(null); return }
    saveDay(date, [...cur, recipeId])
    setMenuPickDate(null)
  }
  const removeFromMenu = (date, index) => {
    saveDay(date, (menuByDate[date] || []).filter((_, i) => i !== index))
  }
  const clearMenuDay = (date) => saveDay(date, [])

  // Межі тижнів: у плануванні доступні лише цей і наступний тиждень; в історії — минулі (до 52 тижнів).
  const thisWeekStart = startOfWeek(weekStartSetting, todayApiDate())
  const nextWeekStart = toApiDate(addDays(fromApiDate(thisWeekStart), 7))
  const prevWeekStart = toApiDate(addDays(fromApiDate(thisWeekStart), -7))
  const historyFloor = toApiDate(addDays(fromApiDate(thisWeekStart), -52 * 7))
  const isHistory = menuMode === 'history'
  const canPrevWeek = isHistory ? weekStart > historyFloor : weekStart > thisWeekStart
  const canNextWeek = isHistory ? weekStart < prevWeekStart : weekStart < nextWeekStart
  const goWeek = (deltaWeeks) => {
    const cand = toApiDate(addDays(fromApiDate(weekStart), deltaWeeks * 7))
    const lo = isHistory ? historyFloor : thisWeekStart
    const hi = isHistory ? prevWeekStart : nextWeekStart
    setWeekStart(cand < lo ? lo : cand > hi ? hi : cand)
  }
  // Перемикання планування ↔ історія: ставимо відповідний стартовий тиждень.
  const switchMenuMode = (toHistory) => {
    setMenuMode(toHistory ? 'history' : 'plan')
    setWeekStart(toHistory ? prevWeekStart : thisWeekStart)
  }

  // Страву можна лише додати/прибрати з обраних (готувати її не можна — §4.6 спрощено).
  const handleToggleFavorite = async (recipe) => {
    const willSelect = !selected.includes(recipe.id)
    setSelected((prev) => (willSelect ? [...prev, recipe.id] : prev.filter((id) => id !== recipe.id)))
    await apiToggleSelected(recipe.id, willSelect)
  }

  if (loading) {
    return (
      <div className="food-page">
        <p className="placeholder-text">{t('common.loading')}</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="food-page">
        <p className="placeholder-text">{t('common.error')}</p>
      </div>
    )
  }

  const favoriteRecipes = recipes.filter((r) => selected.includes(r.id))
  const menuCount = Object.values(menuByDate).reduce((sum, ids) => sum + ids.length, 0)
  const stockRows = products
    .filter((p) => stock[p.id] && stock[p.id] !== 'OutOfStock')
    .map((p) => ({ product: p, state: stock[p.id] }))
  const stockGroups = [...new Set(stockRows.map((r) => r.product.storageGroup))]
  const filteredStock =
    stockCat === 'all' ? stockRows : stockRows.filter((r) => r.product.storageGroup === stockCat)
  // Сортування запасів: за абеткою або за наявністю (спочатку жовті "закінчується", потім зелені).
  const visibleStock = [...filteredStock].sort((a, b) => {
    if (stockSort === 'alpha') return productName(a.product, language).localeCompare(productName(b.product, language))
    if (stockSort === 'availability') {
      const rank = (s) => (s === 'RunningLow' ? 0 : 1)
      return rank(a.state) - rank(b.state)
    }
    return 0
  })
  const addable = products
    .filter((p) => !stock[p.id] || stock[p.id] === 'OutOfStock')
    .filter((p) => productName(p, language).toLowerCase().includes(stockSearch.trim().toLowerCase()))

  return (
    <div className="food-page">
      <div className="food-tabs">
        <button
          type="button"
          className={tab === 'menu' ? 'food-tab food-tab--active' : 'food-tab'}
          onClick={() => setTab('menu')}
        >
          <span className="food-tab-icon"><Icon name="calendar-days" /></span>
          <span className="food-tab-title">{t('food.tabMenu')}</span>
          <span className="food-tab-meta">{t('food.tabMenuMeta', { count: menuCount })}</span>
        </button>
        <button
          type="button"
          className={tab === 'dishes' ? 'food-tab food-tab--active' : 'food-tab'}
          onClick={() => setTab('dishes')}
        >
          <span className="food-tab-icon"><Icon name="cake" /></span>
          <span className="food-tab-title">{t('food.tabDishes')}</span>
          <span className="food-tab-meta">
            {t('food.tabDishesMeta', { count: recipes.length, sel: selected.length })}
          </span>
        </button>
        <button
          type="button"
          className={tab === 'stock' ? 'food-tab food-tab--active' : 'food-tab'}
          onClick={() => setTab('stock')}
        >
          <span className="food-tab-icon"><Icon name="cart" /></span>
          <span className="food-tab-title">{t('food.tabStock')}</span>
          <span className="food-tab-meta">{t('food.tabStockMeta', { count: stockRows.length })}</span>
        </button>
      </div>

      {tab === 'menu' ? (
        <div className="food-menu">
          {favoriteRecipes.length === 0 && (
            <p className="food-health-note food-menu-note">{t('food.menuNoFavorites')}</p>
          )}

          {/* Навігатор тижнів: планування — цей+наступний тиждень; історія — минулі (лише перегляд). */}
          <div className="food-menu-weeknav">
            <button type="button" className="btn-ghost food-menu-navbtn" onClick={() => goWeek(-1)} disabled={!canPrevWeek} aria-label={t('food.menuPrevWeek')}>
              <Icon name="chevron-left" />
            </button>
            <span className="food-menu-weeklabel">{ddmm(weekDates[0])} – {ddmm(weekDates[6])}</span>
            <button type="button" className="btn-ghost food-menu-navbtn" onClick={() => goWeek(1)} disabled={!canNextWeek} aria-label={t('food.menuNextWeek')}>
              <Icon name="chevron-left" className="food-menu-next" />
            </button>
            <button type="button" className="btn-ghost food-menu-today" onClick={() => switchMenuMode(!isHistory)}>
              {isHistory ? t('food.menuHistoryBack') : t('food.menuHistoryOpen')}
            </button>
          </div>
          {isHistory && <p className="food-menu-note food-menu-history-note">{t('food.menuHistoryNote')}</p>}

          <div className={menuLoading ? 'food-menu-grid food-menu-grid--loading' : 'food-menu-grid'}>
            {weekDates.map((date, i) => {
              const dayIds = menuByDate[date] || []
              const isToday = date === todayApiDate()
              return (
                <div key={date} className={isToday ? 'food-menu-day food-menu-day--today' : 'food-menu-day'}>
                  <div className="food-menu-day-head">
                    <span className="food-menu-day-name">
                      {weekdays[i]} <span className="food-menu-day-date">{ddmm(date)}</span>
                    </span>
                    {!isHistory && dayIds.length > 0 && (
                      <button
                        type="button"
                        className="food-menu-clear"
                        onClick={() => clearMenuDay(date)}
                        title={t('food.menuClearDay')}
                        aria-label={t('food.menuClearDay')}
                      >
                        <Icon name="close" />
                      </button>
                    )}
                  </div>
                  <div className="food-menu-dishes">
                    {dayIds.length === 0 ? (
                      <span className="food-menu-empty">{t('food.menuDayEmpty')}</span>
                    ) : (
                      dayIds.map((id, idx) => {
                        const r = recipeMap[id]
                        if (!r) return null
                        return (
                          <span key={`${id}-${idx}`} className="food-menu-chip">
                            <span className="food-menu-chip-name">{recipeName(r, language)}</span>
                            {r.health?.forbidden ? (
                              <span className="food-menu-chip-health food-menu-chip-health--bad" title={tagLabel(r.health.forbidden)}>
                                {t('food.health.forbidden')}
                              </span>
                            ) : r.health?.avoid ? (
                              <span className="food-menu-chip-health food-menu-chip-health--warn" title={tagLabel(r.health.avoid)}>
                                {t('food.health.avoid')}
                              </span>
                            ) : null}
                            {!isHistory && (
                              <button
                                type="button"
                                className="food-menu-chip-x"
                                onClick={() => removeFromMenu(date, idx)}
                                aria-label={t('common.delete')}
                              >
                                <Icon name="close" />
                              </button>
                            )}
                          </span>
                        )
                      })
                    )}
                  </div>
                  {!isHistory && (
                    <button
                      type="button"
                      className="food-menu-add"
                      onClick={() => setMenuPickDate(date)}
                      disabled={favoriteRecipes.length === 0 || dayIds.length >= MAX_MENU_PER_DAY}
                      title={dayIds.length >= MAX_MENU_PER_DAY ? t('food.menuDayFull') : undefined}
                    >
                      <Icon name="plus" /> {t('food.menuAddDish')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : tab === 'dishes' ? (
        <div className="food-feed">
          <div className="filter-bar">
            <div className="filter-bar-modes">
              <button
                type="button"
                className={mode === 'all' ? 'pill pill--active' : 'pill'}
                onClick={() => setMode('all')}
              >
                {t('food.filterAll')}
              </button>
              <button
                type="button"
                className={mode === 'available' ? 'pill pill--active' : 'pill'}
                onClick={() => setMode('available')}
              >
                {t('food.filterAvailable')}
              </button>
              <span className={`pill price-range${mode === 'available' ? ' price-range--off' : ''}`}>
                <span>{t('food.rangeFrom')}</span>
                <input
                  type="number"
                  min="0"
                  max={balance}
                  value={range.from}
                  onChange={handleRangeFrom}
                  disabled={mode === 'available'}
                />
                <span>{t('food.rangeTo')}</span>
                <input
                  type="number"
                  min="0"
                  max={balance}
                  value={range.to}
                  onChange={handleRangeTo}
                  disabled={mode === 'available'}
                />
                <span>{t('landing.moneyCurrency')}</span>
              </span>
            </div>
            <button type="button" className="pill" onClick={() => setFavoritesOpen(true)}>
              <Icon name="cake" /> {t('food.myFavorites', { count: selected.length })}
            </button>
            {excludedRecipes.length > 0 && (
              <button
                type="button"
                className={showExcluded ? 'pill pill--active' : 'pill'}
                onClick={() => setShowExcluded((v) => !v)}
              >
                <Icon name="info" /> {t('food.showExcluded', { count: excludedRecipes.length })}
              </button>
            )}
          </div>

          {visibleRecipes.length === 0 ? (
            <p className="placeholder-text">{t('food.emptyRecipes')}</p>
          ) : (
            <div className="recipe-grid">
              {visibleRecipes.map((recipe) => {
                const av = availability[recipe.id]
                const hs = recipe.health || {}
                const isFav = selected.includes(recipe.id)
                return (
                  <div
                    key={recipe.id}
                    className={isFav ? 'recipe-card recipe-card--selected' : 'recipe-card'}
                  >
                    <div className="recipe-card-body">
                      <div className="recipe-card-head">
                        <label className="recipe-check">
                          <input
                            type="checkbox"
                            checked={isFav}
                            onChange={() => handleToggleFavorite(recipe)}
                          />
                          <span className="recipe-check-box" />
                        </label>
                        <span className="recipe-card-name">{recipeName(recipe, language)}</span>
                      </div>
                      <span className="recipe-card-time">{t('food.minutes', { n: recipe.cookTimeMinutes })}</span>
                      {av.isAvailable ? (
                        <span className="badge badge--ok">{t('food.badgeHave')}</span>
                      ) : (
                        <span className="badge badge--warn">
                          {av.missingCost > 0
                            ? t('food.badgeBuy', { count: av.missingCount, cost: av.missingCost })
                            : t('food.badgeBuyNoPrice', { count: av.missingCount })}
                        </span>
                      )}
                      {hs.avoid && (
                        <span className="food-avoid-note">
                          {t('food.avoidNote', { tag: tagLabel(hs.avoid) })}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {showExcluded && excludedRecipes.length > 0 && (
            <div className="food-excluded">
              <div className="food-excluded-head">{t('food.excludedTitle', { count: excludedRecipes.length })}</div>
              <ul className="food-excluded-list">
                {excludedRecipes.map(({ recipe, reason }) => (
                  <li key={recipe.id} className="food-excluded-row">
                    <span className="food-excluded-name">{recipeName(recipe, language)}</span>
                    <span className={`food-excluded-reason food-excluded-reason--${reason.kind}`}>
                      {reason.kind === 'health'
                        ? t('food.excluded.health', { tag: tagLabel(reason.tag) })
                        : reason.kind === 'stock'
                          ? t('food.excluded.stock', { n: reason.n })
                          : t('food.excluded.budget')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="card food-stock">
          <div className="section-title">
            <h3>{t('food.stockTitle')}</h3>
          </div>
          <div className="food-stock-cats">
            <button
              type="button"
              className={stockCat === 'all' ? 'pill pill--active' : 'pill'}
              onClick={() => setStockCat('all')}
            >
              {t('food.filterAll')}
            </button>
            {stockGroups.map((g) => (
              <button
                key={g}
                type="button"
                className={stockCat === g ? 'pill pill--active' : 'pill'}
                onClick={() => setStockCat(g)}
              >
                {t(`food.group.${g}`)}
              </button>
            ))}
          </div>
          <div className="food-stock-sort">
            <span className="food-stock-sort-label">{t('food.sortBy')}</span>
            {['default', 'alpha', 'availability'].map((key) => (
              <button
                key={key}
                type="button"
                className={stockSort === key ? 'pill pill--active' : 'pill'}
                onClick={() => setStockSort(key)}
              >
                {t(`food.sort.${key}`)}
              </button>
            ))}
          </div>
          <div className="stock-cards">
            {visibleStock.map(({ product, state }) => {
              const hs = product.health || {}
              return (
                <div key={product.id} className="stock-card">
                  <span className="stock-card-name">{productName(product, language)}</span>
                  <div className="stock-card-row">
                    {hs.forbidden ? (
                      <span className="health-flag health-flag--bad" title={tagLabel(hs.forbidden)}>
                        {t('food.health.forbidden')}
                      </span>
                    ) : hs.avoid ? (
                      <span className="health-flag health-flag--warn" title={tagLabel(hs.avoid)}>
                        {t('food.health.avoid')}
                      </span>
                    ) : (
                      <span className="health-flag health-flag--ok">{t('food.health.ok')}</span>
                    )}
                    <div className="stock-toggle" role="radiogroup" aria-label={t('food.col.state')}>
                      {STOCK_TOGGLE.map(({ state: s, cls }) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={state === s}
                          aria-label={t(`food.state.${s}`)}
                          title={t(`food.state.${s}`)}
                          className={`stock-circle stock-circle--${cls}${state === s ? ' stock-circle--on' : ''}`}
                          onClick={() => handleStockState(product.id, s)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <button type="button" className="btn-accent stock-add-btn" onClick={() => setAddStockOpen(true)}>
            {t('food.addStock')}
          </button>
        </div>
      )}

      {/* Пікер страви для конкретної дати тижневого меню — зі списку обраних страв */}
      {menuPickDate != null && (
        <Drawer
          title={t('food.menuPickTitle', { day: ddmm(menuPickDate) })}
          onClose={() => setMenuPickDate(null)}
        >
          {(() => {
            const dayIds = menuByDate[menuPickDate] || []
            const wk = menuHints.byWeekday.filter((id) => recipeMap[id] && !dayIds.includes(id))
            const ov = menuHints.overall.filter(
              (id) => recipeMap[id] && !dayIds.includes(id) && !wk.includes(id),
            )
            const renderHints = (ids, labelKey) =>
              ids.length > 0 && (
                <div className="food-menu-hints">
                  <span className="food-menu-hints-label">{t(labelKey)}</span>
                  <div className="food-menu-hints-chips">
                    {ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="pill food-menu-hint"
                        onClick={() => addToMenu(menuPickDate, id)}
                      >
                        <Icon name="plus" /> {recipeName(recipeMap[id], language)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            return (
              <>
                {renderHints(wk, 'food.menuHintWeekday')}
                {renderHints(ov, 'food.menuHintOverall')}
              </>
            )
          })()}

          {favoriteRecipes.length === 0 ? (
            <p className="placeholder-text">{t('food.favoritesEmpty')}</p>
          ) : (
            <ul className="dish-list">
              {favoriteRecipes.map((recipe) => (
                <li key={recipe.id} className="dish-row">
                  <span className="dish-name">{recipeName(recipe, language)}</span>
                  <button
                    type="button"
                    className="pill"
                    onClick={() => addToMenu(menuPickDate, recipe.id)}
                  >
                    {t('food.add')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Drawer>
      )}

      {/* Панель "Обрані страви" — виїжджає справа (planner-spec.md §4.6) */}
      {favoritesOpen && (
        <Drawer title={t('food.favoritesTitle', { count: selected.length })} onClose={() => setFavoritesOpen(false)}>
          {favoriteRecipes.length === 0 ? (
            <p className="placeholder-text">{t('food.favoritesEmpty')}</p>
          ) : (
            <ul className="dish-list">
              {favoriteRecipes.map((recipe) => (
                <li key={recipe.id} className="dish-row">
                  <span className="dish-name">{recipeName(recipe, language)}</span>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => handleToggleFavorite(recipe)}
                  >
                    {t('food.removeFavorite')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn-accent" onClick={() => setFavoritesOpen(false)}>
            {t('common.close')}
          </button>
        </Drawer>
      )}

      {/* Панель "Додати запаси" — продукти, яких ще немає в наявності */}
      {addStockOpen && (
        <Drawer title={t('food.addStockTitle')} onClose={() => setAddStockOpen(false)}>
          <input
            type="text"
            className="drawer-search"
            placeholder={t('food.searchProduct')}
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
          />
          <ul className="drawer-product-list">
            {addable.map((product) => (
              <li key={product.id}>
                <span>{productName(product, language)}</span>
                <button type="button" className="pill" onClick={() => handleAddStock(product.id)}>
                  {t('food.add')}
                </button>
              </li>
            ))}
          </ul>
        </Drawer>
      )}

    </div>
  )
}

function Drawer({ title, onClose, children }) {
  const { t } = useI18n()
  return (
    <div className="drawer-overlay drawer-overlay--open">
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer-panel">
        <div className="drawer-head">
          <h3>{title}</h3>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')} data-tooltip={t('common.close')}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </aside>
    </div>
  )
}
