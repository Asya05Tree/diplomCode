import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import NumberStepper from '../components/NumberStepper'
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

// planner-spec.md §3.8 + spisok-pokupok.md — список покупок на бекенді. Позиції згруповано за
// трьома розділами (Продукти / Аптека / Інше), ціна вводиться в момент відмітки покупки (один
// жест: запас + ціна + витрата), а не при додаванні. Під списком — «часто купуєте», сума чека
// та фільтр докупівлі в межах бюджету. Жодних захардкоджених цін.
const SECTIONS = ['Groceries', 'Pharmacy', 'Other']

export default function ShoppingList() {
  const { t, language } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [items, setItems] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [priceCoverage, setPriceCoverage] = useState({ known: 0, total: 0 })

  // Форма додавання: назва + розділ (+ необов'язкова категорія-хештег).
  const [name, setName] = useState('')
  const [section, setSection] = useState('Groceries')
  const [category, setCategory] = useState('')

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
    if (!name.trim()) return
    await addShoppingItem({ section, text: name.trim(), category: category.trim() || null })
    setName('')
    setCategory('')
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

  const grouped = SECTIONS.map((sec) => [sec, items.filter((x) => x.section === sec)])
  const currency = t('landing.moneyCurrency')

  return (
    <div className="shopping-list-page">
      <h2 className="shopping-list-title"><Icon name="cart" /> {t('shoppingList.title')}</h2>

      <form className="shopping-list-add card" onSubmit={handleAdd}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('shoppingList.addPlaceholder')}
        />
        <label className="shopping-list-cat-field">
          <span>{t('shoppingList.sectionFormLabel')}</span>
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            {SECTIONS.map((sec) => (
              <option key={sec} value={sec}>
                {t(`shoppingList.section.${sec}`)}
              </option>
            ))}
          </select>
        </label>
        <input
          className="shopping-list-cat-input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t('shoppingList.categoryPlaceholder')}
        />
        <button type="submit"><Icon name="plus" /> {t('shoppingList.addButton')}</button>
      </form>

      <div className="shopping-list-groups">
        {grouped.map(([sec, list]) => (
          <div key={sec} className="card shopping-list-group">
            <h3>{t(`shoppingList.section.${sec}`)}</h3>
            {list.length === 0 ? (
              <p className="shopping-list-group-empty">{t('shoppingList.groupEmpty')}</p>
            ) : (
              <ul>
                {list.map((item) => (
                  <li
                    key={item.id}
                    className={item.isChecked ? 'shopping-list-row is-owned' : 'shopping-list-row'}
                  >
                    <label className="shopping-list-owned" title={t('shoppingList.checkButton')}>
                      <input
                        type="checkbox"
                        checked={item.isChecked}
                        disabled={item.isChecked}
                        onChange={() => openCheck(item.id)}
                      />
                    </label>
                    <span className="shopping-list-name">{displayName(item)}</span>
                    {item.estimatedPrice != null && (
                      <span className="shopping-list-price">
                        {item.estimatedPrice} {currency}
                        {item.priceAgeMonths != null && item.priceAgeMonths > 0 && (
                          <span className="shopping-list-price-age">
                            {' '}· {t('shoppingList.priceAge', { n: item.priceAgeMonths })}
                          </span>
                        )}
                      </span>
                    )}
                    <input
                      className="shopping-list-cat-input shopping-list-cat-inline"
                      defaultValue={item.category ?? ''}
                      placeholder={t('shoppingList.categoryPlaceholder')}
                      onBlur={(e) => {
                        if ((e.target.value.trim() || null) !== (item.category ?? null)) {
                          handleCategoryChange(item.id, e.target.value)
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="shopping-list-del"
                      onClick={() => handleDelete(item.id)}
                      aria-label={t('planner.actionDelete')}
                      data-tooltip={t('planner.actionDelete')}
                    >
                      <Icon name="trash" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

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
          <NumberStepper min={0} value={budget} onChange={(v) => setBudget(v)} />
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
          <NumberStepper min={0} value={receiptTotal} onChange={(v) => setReceiptTotal(v)} />
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
