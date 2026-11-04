import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import NumberStepper from '../components/NumberStepper'
import { RANGES } from '../utils/validation'
import {
  SHOPPING_CATEGORIES,
  SHOPPING_SECTIONS,
  shoppingCategoryName,
  sectionName,
  sectionForCategory,
  guessShoppingCategory,
} from '../utils/shoppingCategories'
import {
  getShoppingList,
  addShoppingItem,
  removeShoppingItem,
  setItemCategory,
  checkItem,
  submitReceiptTotal,
  planTrip,
} from '../api/shopping'
import './ShoppingList.css'

// planner-spec.md §3.8 + spisok-pokupok.md — список покупок на бекенді. Позиції показуються
// картками з фільтром за розділом; розділ і категорія визначаються автоматично за назвою (можна
// змінити категорію в картці). Ціна вводиться в момент відмітки покупки (один жест: запас + ціна +
// витрата). Під списком — «часто купуєте», сума чека та фільтр докупівлі в межах бюджету.

export default function ShoppingList() {
  const { t, language } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [items, setItems] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [priceCoverage, setPriceCoverage] = useState({ known: 0, total: 0 })

  // Форма додавання: лише назва — розділ і категорію визначаємо автоматично.
  const [name, setName] = useState('')
  // Фільтр за розділом ('all' = усі розділи).
  const [sectionFilter, setSectionFilter] = useState('all')

  // Відмітка покупки: активна позиція + введена (необов'язкова) ціна.
  const [checkingId, setCheckingId] = useState(null)
  const [checkPrice, setCheckPrice] = useState('')

  // Сума чека та її розподіл по позиціях без ціни.
  const [receiptTotal, setReceiptTotal] = useState('')
  const [receiptResult, setReceiptResult] = useState(null)

  // Докупити в межах бюджету: сума (грн) або кількість позицій — залежно від покриття цінами.
  const [budget, setBudget] = useState('')

  const [tripTaskId, setTripTaskId] = useState(null)

  const reload = async () => {
    const data = await getShoppingList()
    setItems(data.items)
    setSuggestions(data.suggestions)
    setPriceCoverage(data.priceCoverage)
  }

  useEffect(() => {
    let cancelled = false
    getShoppingList()
      .then((data) => {
        if (cancelled) return
        setItems(data.items)
        setSuggestions(data.suggestions)
        setPriceCoverage(data.priceCoverage)
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

  const displayName = (x) => (language === 'en' ? x.displayNameEn : x.displayNameUk)

  const handleAdd = async (e) => {
    e.preventDefault()
    const text = name.trim()
    if (!text) return
    // Автовизначення категорії за назвою → звідси й розділ.
    const cat = guessShoppingCategory(text)
    await addShoppingItem({ section: sectionForCategory(cat), text, category: cat })
    setName('')
    await reload()
  }

  const handleDelete = async (id) => {
    await removeShoppingItem(id)
    await reload()
  }

  const handleCategoryChange = async (id, value) => {
    await setItemCategory(id, value.trim() || null)
    await reload()
  }

  const openCheck = (id) => {
    setCheckingId(id)
    setCheckPrice('')
  }

  const confirmCheck = async (withPrice) => {
    const id = checkingId
    const price = withPrice && checkPrice !== '' ? Number(checkPrice) : undefined
    setCheckingId(null)
    setCheckPrice('')
    await checkItem(id, price)
    await reload()
  }

  const handleSuggestion = async (productId) => {
    await addShoppingItem({ section: 'Groceries', productId })
    await reload()
  }

  const handleReceipt = async () => {
    if (receiptTotal === '') return
    const result = await submitReceiptTotal(Number(receiptTotal))
    setReceiptResult(result)
    await reload()
  }

  const handlePlanTrip = async () => {
    const { taskId } = await planTrip()
    setTripTaskId(taskId)
  }

  // Режим докупівлі: якщо відомо менше половини цін — чесно фільтруємо за КІЛЬКІСТЮ позицій,
  // інакше — за СУМОЮ в грн (spisok-pokupok.md). Рахуємо тільки невідмічені позиції.
  const byCount = priceCoverage.known < priceCoverage.total / 2
  const toBuy = useMemo(() => items.filter((x) => !x.isChecked), [items])

  const fitItems = useMemo(() => {
    const limit = budget === '' ? 0 : Number(budget)
    if (limit <= 0) return []
    if (byCount) return toBuy.slice(0, limit)
    const fit = []
    let sum = 0
    for (const x of toBuy) {
      const price = x.estimatedPrice ?? 0
      if (sum + price > limit) continue
      sum += price
      fit.push(x)
    }
    return fit
  }, [toBuy, budget, byCount])

  if (loading) {
    return (
      <div className="shopping-list-page">
        <p className="placeholder-text">{t('common.loading')}</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="shopping-list-page">
        <p className="placeholder-text">{t('common.error')}</p>
      </div>
    )
  }

  const currency = t('landing.moneyCurrency')
  // Розділи, у яких є позиції (для фільтра), у сталому порядку
  const presentSections = SHOPPING_SECTIONS.filter((s) => items.some((x) => x.section === s.key))
  const visibleItems = sectionFilter === 'all' ? items : items.filter((x) => x.section === sectionFilter)

  return (
    <div className="shopping-list-page">
      <form className="shopping-list-add card" onSubmit={handleAdd}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('shoppingList.addPlaceholder')}
        />
        <button type="submit"><Icon name="plus" /> {t('shoppingList.addButton')}</button>
      </form>

      {/* Фільтр за розділом: усі / наявні розділи */}
      <div className="shopping-sections">
        <button type="button" className={sectionFilter === 'all' ? 'pill pill--active' : 'pill'} onClick={() => setSectionFilter('all')}>
          {t('shoppingList.allSections')}
        </button>
        {presentSections.map((s) => (
          <button key={s.key} type="button" className={sectionFilter === s.key ? 'pill pill--active' : 'pill'} onClick={() => setSectionFilter(s.key)}>
            {sectionName(s.key, language)}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <p className="placeholder-text">{t('shoppingList.empty')}</p>
      ) : (
        <div className="shopping-cards">
          {visibleItems.map((item) => (
            <div key={item.id} className={item.isChecked ? 'shopping-card is-owned' : 'shopping-card'}>
              <label className="shopping-card-check" title={t('shoppingList.checkButton')}>
                <input
                  type="checkbox"
                  checked={item.isChecked}
                  disabled={item.isChecked}
                  onChange={() => openCheck(item.id)}
                />
              </label>
              <div className="shopping-card-body">
                <span className="shopping-card-name">{displayName(item)}</span>
                {item.estimatedPrice != null && (
                  <span className="shopping-list-price">
                    {item.estimatedPrice} {currency}
                    {item.priceAgeMonths != null && item.priceAgeMonths > 0 && (
                      <span className="shopping-list-price-age"> · {t('shoppingList.priceAge', { n: item.priceAgeMonths })}</span>
                    )}
                  </span>
                )}
                <select
                  className="shopping-card-cat"
                  value={SHOPPING_CATEGORIES.some((c) => c.key === item.category) ? item.category : ''}
                  title={shoppingCategoryName(item.category, language) || t('shoppingList.categoryFormLabel')}
                  onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                >
                  <option value="">{t('shoppingList.categoryNone')}</option>
                  {SHOPPING_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {language === 'en' ? c.en : c.uk}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="shopping-card-del"
                onClick={() => handleDelete(item.id)}
                aria-label={t('planner.actionDelete')}
                data-tooltip={t('planner.actionDelete')}
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Спливна відмітка покупки: ціна необов'язкова (spisok-pokupok.md §2) */}
      {checkingId != null && (
        <div className="drawer-overlay drawer-overlay--open">
          <div className="drawer-backdrop" onClick={() => setCheckingId(null)} />
          <aside className="drawer-panel shopping-check-panel">
            <div className="drawer-head">
              <h3>{t('shoppingList.checkButton')}</h3>
              <button
                type="button"
                className="drawer-close"
                onClick={() => setCheckingId(null)}
                aria-label={t('shoppingList.checkCancel')}
                data-tooltip={t('shoppingList.checkCancel')}
              >
                <Icon name="close" />
              </button>
            </div>
            <label className="shopping-check-field">
              <span>{t('shoppingList.priceOptional')}</span>
              <NumberStepper
                min={0}
                max={RANGES.money.max}
                allowDecimal
                value={checkPrice}
                onChange={(v) => setCheckPrice(v)}
                placeholder={t('shoppingList.priceOptional')}
              />
            </label>
            <div className="shopping-check-actions">
              <button type="button" className="btn-outline" onClick={() => confirmCheck(false)}>
                {t('shoppingList.checkNoPrice')}
              </button>
              <button type="button" className="btn-accent" onClick={() => confirmCheck(true)}>
                {t('shoppingList.checkConfirm')}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* «Часто купуєте» — історія покупок за 90 днів (spisok-pokupok.md §1) */}
      {suggestions.length > 0 && (
        <div className="card shopping-suggestions">
          <h3>{t('shoppingList.suggestionsTitle')}</h3>
          <div className="shopping-suggestion-pills">
            {suggestions.map((s) => (
              <button
                key={s.productId}
                type="button"
                className="pill shopping-suggestion-pill"
                onClick={() => handleSuggestion(s.productId)}
              >
                <Icon name="plus" /> {language === 'en' ? s.displayNameEn : s.displayNameUk}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Докупити в межах бюджету: за сумою (грн) або за кількістю — залежно від покриття цінами */}
      <div className="card shopping-budget">
        <h3>{t('shoppingList.budgetTitle')}</h3>
        <label className="shopping-check-field">
          <span>{byCount ? t('shoppingList.budgetCountLabel') : t('shoppingList.budgetSumLabel')}</span>
          <NumberStepper min={0} max={RANGES.money.max} value={budget} onChange={(v) => setBudget(v)} />
        </label>
        {byCount && priceCoverage.total > 0 && (
          <p className="placeholder-text">{t('shoppingList.budgetCountNote')}</p>
        )}
        {budget !== '' && Number(budget) > 0 && (
          fitItems.length === 0 ? (
            <p className="placeholder-text">{t('shoppingList.budgetEmpty')}</p>
          ) : (
            <>
              <p className="shopping-list-total">{t('shoppingList.budgetFitsCount', { count: fitItems.length })}</p>
              <ul className="shopping-budget-list">
                {fitItems.map((x) => (
                  <li key={x.id}>
                    <span>{displayName(x)}</span>
                    {!byCount && x.estimatedPrice != null && (
                      <span className="shopping-list-price">{x.estimatedPrice} {currency}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )
        )}
      </div>

      {/* Сума чека: розкладаємо залишок по відмічених позиціях без ціни (spisok-pokupok.md §2) */}
      <div className="card shopping-receipt">
        <h3>{t('shoppingList.receiptTitle')}</h3>
        <p className="placeholder-text">{t('shoppingList.receiptHint')}</p>
        <div className="shopping-receipt-form">
          <NumberStepper min={0} max={RANGES.money.max} allowDecimal value={receiptTotal} onChange={(v) => setReceiptTotal(v)} />
          <button type="button" className="btn-accent" onClick={handleReceipt}>
            {t('shoppingList.receiptButton')}
          </button>
        </div>
        {receiptResult && (
          <div className="shopping-receipt-result">
            <p className="shopping-list-total">
              {t('shoppingList.receiptResult', {
                total: receiptResult.total,
                known: receiptResult.knownSum,
                remainder: receiptResult.remainder,
              })}
            </p>
            {receiptResult.split.length > 0 && (
              <>
                <p className="placeholder-text">
                  {t('shoppingList.receiptPerItem', { perItem: receiptResult.perItem })}
                </p>
                <ul className="shopping-budget-list">
                  {receiptResult.split.map((s) => (
                    <li key={s.itemId}>
                      <span>{language === 'en' ? s.displayNameEn : s.displayNameUk}</span>
                      <span className="shopping-list-price">{s.price} {currency}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {/* Запланувати похід у магазин → задача в «Нерозподілених» */}
      <div className="card shopping-trip">
        <button type="button" className="btn-accent" onClick={handlePlanTrip}>
          <Icon name="cart" /> {t('shoppingList.planTrip')}
        </button>
        {tripTaskId != null && (
          <p className="placeholder-text">{t('shoppingList.planTripDone', { taskId: tripTaskId })}</p>
        )}
      </div>
    </div>
  )
}
