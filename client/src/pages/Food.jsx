import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { getFinanceBalance } from '../utils/finance'
import { addShoppingItem } from '../utils/shoppingList'
import {
  RECIPES,
  addStockProduct,
  computeAvailability,
  getProduct,
  getSelected,
  getStockMap,
  ingredientAmount,
  listAddableProducts,
  listStock,
  markCooked,
  productName,
  recipeName,
  setStockState,
  toggleSelected,
} from '../pseudo-db'
import './Food.css'

const STOCK_TOGGLE = [
  { state: 'Available', cls: 'ok' },
  { state: 'RunningLow', cls: 'warn' },
  { state: 'OutOfStock', cls: 'bad' },
]

// Модуль "Їжа" (planner-spec.md §4.6): лента рецептів з фільтрами, запаси з триступеневим
// станом "є / закінчується / немає", обрані страви та підтвердження готовки. Дані беруться
// з псевдо-БД (client/src/pseudo-db) — поки бекенд їжі не реалізований.
export default function Food() {
  const { t, language } = useI18n()

  // Бюджет на докупівлю — скільки у користувача грошей (вводиться у "Фінансах", §3.6).
  // Діапазон "від / до" за замовчуванням 0..баланс і не виходить за ці межі (§4.6 "з покупками до N").
  const [balance] = useState(() => getFinanceBalance())
  const [range, setRange] = useState(() => ({ from: 0, to: getFinanceBalance() }))
  const [mode, setMode] = useState('all') // 'all' | 'available'

  const [stockMap, setStockMap] = useState(() => getStockMap())
  const [selected, setSelected] = useState(() => getSelected())

  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [stockSearch, setStockSearch] = useState('')

  // Спливне вікно готовки: { recipe, step: 'confirm'|'result', have: {productId: bool}, states: {productId: state} }
  const [cooking, setCooking] = useState(null)

  // Наявність рахуємо один раз на поточні запаси й перевикористовуємо для фільтра й бейджів.
  const availability = useMemo(() => {
    const map = {}
    for (const recipe of RECIPES) map[recipe.id] = computeAvailability(recipe, stockMap)
    return map
  }, [stockMap])

  const visibleRecipes = useMemo(() => {
    return RECIPES.filter((recipe) => {
      const av = availability[recipe.id]
      // "Із наявного" — лише те, де все є (§4.6: страви з нестачею не показуються взагалі).
      if (mode === 'available') return av.isAvailable
      // "Все" з бюджетом: показуємо рецепт, якщо докупівля вкладається в діапазон від..до.
      return av.missingCost >= range.from && av.missingCost <= range.to
    })
  }, [availability, mode, range])

  const clamp = (value) => Math.min(Math.max(0, Math.round(Number(value) || 0)), balance)

  const handleRangeFrom = (e) => {
    const from = Math.min(clamp(e.target.value), range.to)
    setRange((prev) => ({ ...prev, from }))
  }

  const handleRangeTo = (e) => {
    const to = Math.max(clamp(e.target.value), range.from)
    setRange((prev) => ({ ...prev, to }))
  }

  const handleStockState = (productId, state) => {
    setStockMap({ ...setStockState(productId, state) })
    // "Немає" — продукт списано: він одразу потрапляє в список покупок (§4.8, один жест — кілька ефектів).
    if (state === 'OutOfStock') {
      const product = stockMap[productId] ? null : null
      void product
      const p = RECIPES && null
      void p
      const target = listStock(stockMap).find((s) => s.product.id === productId)
      const prod = target ? target.product : null
      if (prod) addShoppingItem(productName(prod, language), 'food', prod.price)
    }
  }

  const handleAddStock = (productId) => {
    setStockMap({ ...addStockProduct(productId) })
  }

  const handleToggleFavorite = (recipe) => {
    const next = toggleSelected(recipe.id)
    setSelected(next)
    // Щойно відмітили страву галочкою — одразу відкриваємо вікно готовки з картинкою (§4.6).
    if (next.includes(recipe.id)) openCooking(recipe)
  }

  const openCooking = (recipe) => {
    const have = {}
    const states = {}
    for (const ing of recipe.ingredients) {
      const present = stockMap[ing.productId] === 'Available' || stockMap[ing.productId] === 'RunningLow'
      have[ing.productId] = present
      states[ing.productId] = present ? stockMap[ing.productId] : 'OutOfStock'
    }
    setCooking({ recipe, step: 'confirm', have, states })
  }

  const toggleHave = (productId) => {
    setCooking((prev) => ({ ...prev, have: { ...prev.have, [productId]: !prev.have[productId] } }))
  }

  const setResultState = (productId, state) => {
    setCooking((prev) => ({ ...prev, states: { ...prev.states, [productId]: state } }))
  }

  // Крок 2 готовки: застосувати нові стани запасів і оновити LastCookedAt.
  const finishCooking = (keepAll) => {
    const { recipe, states } = cooking
    if (!keepAll) {
      const map = { ...stockMap }
      for (const ing of recipe.ingredients) {
        const newState = states[ing.productId]
        const wasPresent = map[ing.productId] === 'Available' || map[ing.productId] === 'RunningLow'
        setStockState(ing.productId, newState)
        map[ing.productId] = newState
        // Що стало "немає" — у список покупок (§4.6).
        if (newState === 'OutOfStock' && wasPresent) {
          const prod = recipe.ingredients.find((i) => i.productId === ing.productId)
          void prod
          const product = RECIPES ? null : null
          void product
          const p = listAddableProducts(map).find((x) => x.id === ing.productId)
          if (p) addShoppingItem(productName(p, language), 'food', p.price)
        }
      }
      setStockMap(map)
    }
    markCooked(recipe.id)
    setCooking(null)
  }

  const favoriteRecipes = RECIPES.filter((r) => selected.includes(r.id))
  const stockRows = listStock(stockMap)
  const addable = listAddableProducts(stockMap).filter((p) =>
    productName(p, language).toLowerCase().includes(stockSearch.trim().toLowerCase()),
  )

  return (
    <div className="food-page">
      <div className="food-page-head">
        <h2>{t('nav.food')}</h2>
        <span className="variant-note">{t('food.note')}</span>
      </div>

      <div className="food-layout">
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
              🍲 {t('food.myFavorites', { count: selected.length })}
            </button>
          </div>

          {visibleRecipes.length === 0 ? (
            <p className="placeholder-text">{t('food.emptyRecipes')}</p>
          ) : (
            <div className="recipe-grid">
              {visibleRecipes.map((recipe) => {
                const av = availability[recipe.id]
                const isFav = selected.includes(recipe.id)
                return (
                  <div
                    key={recipe.id}
                    className={isFav ? 'recipe-card recipe-card--selected' : 'recipe-card'}
                  >
                    <div className="recipe-card-photo" onClick={() => openCooking(recipe)}>
                      <label className="recipe-check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isFav}
                          onChange={() => handleToggleFavorite(recipe)}
                        />
                        <span className="recipe-check-box" />
                      </label>
                      {isFav && <span className="recipe-ribbon">{t('food.favoriteRibbon')}</span>}
                      <span className="recipe-emoji">{recipe.emoji}</span>
                      <span className="recipe-card-time">
                        {t('food.minutes', { n: recipe.cookTimeMinutes })}
                      </span>
                    </div>
                    <div className="recipe-card-body">
                      <span className="recipe-card-name">{recipeName(recipe, language)}</span>
                      {av.isAvailable ? (
                        <span className="badge badge--ok">{t('food.badgeHave')}</span>
                      ) : (
                        <span className="badge badge--warn">
                          {t('food.badgeBuy', { count: av.missingCount, cost: av.missingCost })}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card food-stock">
          <div className="section-title">
            <h3>{t('food.stockTitle')}</h3>
          </div>
          <ul className="stock-list">
            {stockRows.map(({ product, state }) => (
              <li key={product.id} className="stock-row">
                <span className={`stock-dot stock-dot--${state === 'Available' ? 'ok' : 'warn'}`} />
                <span className="stock-name">{productName(product, language)}</span>
                <div className="stock-toggle">
                  {STOCK_TOGGLE.map(({ state: s, cls }) => (
                    <button
                      key={s}
                      type="button"
                      title={t(`food.state.${s}`)}
                      className={`stock-circle stock-circle--${cls}${state === s ? ' stock-circle--on' : ''}`}
                      onClick={() => handleStockState(product.id, s)}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-accent stock-add-btn" onClick={() => setAddStockOpen(true)}>
            {t('food.addStock')}
          </button>
        </div>
      </div>

      {/* Панель "Обрані страви" — виїжджає справа (planner-spec.md §4.6) */}
      {favoritesOpen && (
        <Drawer title={t('food.favoritesTitle', { count: selected.length })} onClose={() => setFavoritesOpen(false)}>
          {favoriteRecipes.length === 0 ? (
            <p className="placeholder-text">{t('food.favoritesEmpty')}</p>
          ) : (
            <ul className="dish-list">
              {favoriteRecipes.map((recipe) => (
                <li key={recipe.id} className="dish-row">
                  <span className="dish-name">
                    {recipe.emoji} {recipeName(recipe, language)}
                  </span>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setFavoritesOpen(false)
                      openCooking(recipe)
                    }}
                  >
                    {t('food.cooked')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn-accent" onClick={() => setFavoritesOpen(false)}>
            {t('food.planCook')}
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

      {/* Спливне вікно готовки з картинкою страви (над усім екраном, §4.6) */}
      {cooking && (
        <div className="cook-overlay" onClick={() => setCooking(null)}>
          <div className="cook-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cook-photo">{cooking.recipe.emoji}</div>
            <button type="button" className="cook-close" onClick={() => setCooking(null)}>
              ✕
            </button>

            {cooking.step === 'confirm' ? (
              <>
                <h3>{t('food.cookTitle', { name: recipeName(cooking.recipe, language) })}</h3>
                <p className="placeholder-text">{t('food.cookQuestion')}</p>
                <ul className="cook-ingredients">
                  {cooking.recipe.ingredients.map((ing) => {
                    const product = getProductSafe(ing.productId)
                    return (
                      <li key={ing.productId}>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!cooking.have[ing.productId]}
                            onChange={() => toggleHave(ing.productId)}
                          />
                          <span>{productName(product, language)}</span>
                        </label>
                        <span className="cook-amount">{ingredientAmount(ing, language)}</span>
                      </li>
                    )
                  })}
                </ul>
                <div className="cook-actions">
                  <button type="button" className="btn-accent" onClick={() => setCooking((p) => ({ ...p, step: 'result' }))}>
                    {t('food.cookConfirm')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>{t('food.resultTitle')}</h3>
                <ul className="cook-result">
                  {cooking.recipe.ingredients.map((ing) => {
                    const product = getProductSafe(ing.productId)
                    return (
                      <li key={ing.productId}>
                        <span>{productName(product, language)}</span>
                        <div className="stock-toggle">
                          {STOCK_TOGGLE.map(({ state: s, cls }) => (
                            <button
                              key={s}
                              type="button"
                              title={t(`food.state.${s}`)}
                              className={`stock-circle stock-circle--${cls}${cooking.states[ing.productId] === s ? ' stock-circle--on' : ''}`}
                              onClick={() => setResultState(ing.productId, s)}
                            />
                          ))}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <div className="cook-actions">
                  <button type="button" className="btn-outline" onClick={() => finishCooking(true)}>
                    {t('food.keepAll')}
                  </button>
                  <button type="button" className="btn-accent" onClick={() => finishCooking(false)}>
                    {t('food.resultConfirm')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Drawer({ title, onClose, children }) {
  return (
    <div className="drawer-overlay drawer-overlay--open">
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer-panel">
        <div className="drawer-head">
          <h3>{title}</h3>
          <button type="button" className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </aside>
    </div>
  )
}
