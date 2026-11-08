import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import FieldHelp from '../components/FieldHelp'
import NumberStepper from '../components/NumberStepper'
import { RANGES } from '../utils/validation'
import {
  SHOPPING_CATEGORIES,
  SHOPPING_SECTIONS,
  shoppingCategoryName,
  sectionName,
  sectionForCategory,
  guessShoppingCategory,
  hasNonUkrainianCyrillic,
  canonicalizeShoppingName,
} from '../utils/shoppingCategories'
import { addMonths, toApiDate } from '../utils/date'
import {
  getShoppingList,
  addShoppingItem,
  removeShoppingItem,
  setItemCategory,
  checkItem,
  planTrip,
} from '../api/shopping'
import ComboList from '../components/common/ComboList'
import { findMaximalCombos, findCountCombos } from '../utils/combos'
import './ShoppingList.css'
import './Landing.css' // стилі списку комбінацій (.landing-results-*) для автопідбору

// Запобіжник: автопідбір докупівлі ніколи не бере більше стількох позицій за один раз
// (щоб підбір «під бюджет» не перетворювався на весь список).
const MAX_AUTO_ITEMS = 20

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
  const [addNotice, setAddNotice] = useState('') // мʼяке повідомлення (напр. «вже є у списку»)
  // Фільтр за розділом ('all' = усі розділи).
  const [sectionFilter, setSectionFilter] = useState('all')

  // Ручний відбір: фільтр за розділом і підкатегорією серед наявних позицій.
  const [manualSection, setManualSection] = useState('all')
  const [manualCategory, setManualCategory] = useState('all')
  // Автопідбір: обраний (активний) варіант-комбінація — піднімається нагору й підсвічується.
  const [selectedComboKey, setSelectedComboKey] = useState(null)

  // Відмітка покупки: активна позиція + введена (необов'язкова) ціна.
  const [checkingId, setCheckingId] = useState(null)
  const [checkPrice, setCheckPrice] = useState('')

  // Докупити в межах бюджету: вкладка (вручну / автопідбір), режим ліміту (сума грн / кількість),
  // саме значення ліміту та позиції, обрані вручну.
  const [budgetTab, setBudgetTab] = useState('manual')
  const [budgetMode, setBudgetMode] = useState('sum')
  const [budget, setBudget] = useState('')
  const [picked, setPicked] = useState(() => new Set())

  // Похід у магазин: дата-час (обовʼязкові), прапорець «заплановано» та причина, чому дата не
  // підходить (порожня / в минулому / надто далеко) — щоб користувач бачив саме що не так.
  const [tripDate, setTripDate] = useState('')
  const [tripPlanned, setTripPlanned] = useState(false)
  const [tripError, setTripError] = useState('')

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

  // Назва позиції. Продукт/ліки з каталогу вже мають готовий переклад — беремо як є. Для
  // довільного тексту (customText) перекладу в БД немає, тож якщо впізнаємо річ — показуємо
  // локалізовану канонічну назву (англійською для en). Невпізнане («щось незрозуміле») лишаємо
  // як увів користувач.
  const displayName = (x) => {
    if (x.productId != null || x.medicineId != null) {
      return language === 'en' ? x.displayNameEn : x.displayNameUk
    }
    const canon = canonicalizeShoppingName(x.customText || x.displayNameUk || x.displayNameEn)
    if (canon) return language === 'en' ? canon.en : canon.uk
    return x.displayNameUk || x.displayNameEn
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const text = name.trim()
    if (!text) return
    setAddNotice('')
    // Нормальна форма: «тампончик/тампони» → «Тампони». Зберігаємо канонічну назву, а не ввід.
    const canon = canonicalizeShoppingName(text)
    const finalName = canon ? (language === 'en' ? canon.en : canon.uk) : text
    // Дедуплікація: якщо незакуплена позиція вже зводиться до тієї самої речі — не додаємо дубль.
    if (canon) {
      const dup = items.find(
        (x) => !x.isChecked && canonicalizeShoppingName(x.displayNameUk)?.key === canon.key,
      )
      if (dup) {
        setName('')
        setAddNotice(t('shoppingList.alreadyInList', { name: finalName }))
        return
      }
    }
    // Автовизначення категорії за (канонічною) назвою → звідси й розділ.
    const cat = guessShoppingCategory(finalName)
    await addShoppingItem({ section: sectionForCategory(cat), text: finalName, category: cat })
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

  // Межі дати походу: від сьогодні до +12 місяців (щоб не можна було запланувати на 5200-й рік).
  const tripMin = `${toApiDate(new Date())}T00:00`
  const tripMax = `${toApiDate(addMonths(new Date(), 12))}T23:59`

  // Дата й час походу обовʼязкові — задача одразу стає на конкретний день і час (без
  // «Нерозподілених»): плануємо подію, а не безтерміновий нагад.
  const handlePlanTrip = async () => {
    setTripError('')
    // Пояснюємо саме причину, а не просто мовчки нічого не робимо.
    if (!tripDate) { setTripError(t('shoppingList.tripErrEmpty')); return }
    if (tripDate < tripMin) { setTripError(t('shoppingList.tripErrPast')); return }
    if (tripDate > tripMax) { setTripError(t('shoppingList.tripErrTooFar', { date: tripMax.slice(0, 10) })); return }
    await planTrip(tripDate)
    setTripPlanned(true)
  }

  // Докупівля рахує лише невідмічені позиції. Якщо відомо менше половини цін — підбір за сумою
  // недоступний (нема з чого рахувати), лишається лише за кількістю позицій.
  const toBuy = useMemo(() => items.filter((x) => !x.isChecked), [items])
  const pricesScarce = priceCoverage.known < priceCoverage.total / 2
  // Ефективний режим ліміту: за браку цін завжди за кількістю, інакше — обраний користувачем.
  const mode = pricesScarce ? 'count' : budgetMode
  const limit = budget === '' ? 0 : Number(budget)

  // Ручний відбір: що обрано серед наявного + чи не вийшли за ліміт (суму або кількість).
  const pickedItems = useMemo(() => toBuy.filter((x) => picked.has(x.id)), [toBuy, picked])
  const pickedSum = pickedItems.reduce((s, x) => s + (x.estimatedPrice ?? 0), 0)
  const overLimit = limit > 0 && (mode === 'count' ? pickedItems.length > limit : pickedSum > limit)
  const togglePick = (id) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  // Автопідбір «за сумою» показує ВСІ максимальні комбінації під бюджет (той самий алгоритм, що й
  // демо на Landing / у формі задачі «Піти в магазин»), а не один довільний набір.
  const pricedToBuy = useMemo(
    () => toBuy.filter((x) => (x.estimatedPrice ?? 0) > 0).map((x) => ({ id: x.id, name: displayName(x), price: x.estimatedPrice })),
    [toBuy, language],
  )
  const combos = useMemo(
    () => (mode === 'sum' && limit > 0 ? findMaximalCombos(pricedToBuy, limit) : []),
    [pricedToBuy, mode, limit],
  )
  // Автопідбір «за кількістю»: усі комбінації рівно з N позицій (а не перші N зі списку).
  const namedToBuy = useMemo(
    () => toBuy.map((x) => ({ id: x.id, name: displayName(x) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toBuy, language],
  )
  const countCombos = useMemo(
    () => (mode === 'count' && limit > 0 ? findCountCombos(namedToBuy, limit) : []),
    [namedToBuy, mode, limit],
  )

  // Попередження за здоров'ям на позиції-продукті (обчислює бекенд за тегами/обмеженнями «Їжі»).
  const healthBadge = (item) => item.healthWarning && (
    <span className={item.healthWarning === 'Forbidden' ? 'shopping-health shopping-health--bad' : 'shopping-health shopping-health--warn'}>
      <Icon name="warning" /> {t(item.healthWarning === 'Forbidden' ? 'shoppingList.healthForbidden' : 'shoppingList.healthAvoid')}
    </span>
  )

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

  // Ручний відбір: фільтр за розділом (широка група) і підкатегорією (напр. овочі) серед позицій
  // до купівлі. Показуємо лише ті розділи/підкатегорії, що реально присутні.
  const manualSections = SHOPPING_SECTIONS.filter((s) => toBuy.some((x) => x.section === s.key))
  const manualCategories = SHOPPING_CATEGORIES.filter(
    (c) =>
      (manualSection === 'all' || c.section === manualSection) &&
      toBuy.some((x) => x.category === c.key && (manualSection === 'all' || x.section === manualSection)),
  )
  const manualItems = toBuy.filter(
    (x) =>
      (manualSection === 'all' || x.section === manualSection) &&
      (manualCategory === 'all' || x.category === manualCategory),
  )

  return (
    <div className="shopping-list-page">
      <form className="shopping-list-add card" onSubmit={handleAdd}>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setAddNotice('') }}
          placeholder={t('shoppingList.addPlaceholder')}
        />
        <button type="submit"><Icon name="plus" /> {t('shoppingList.addButton')}</button>
        <FieldHelp text={t('shoppingList.addHelp')} label={t('fieldHelp.label')} />
        {hasNonUkrainianCyrillic(name) && (
          <p className="shopping-lang-hint">{t('shoppingList.enterUkrainian')}</p>
        )}
        {addNotice && <p className="shopping-lang-hint shopping-add-notice">{addNotice}</p>}
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
                      <span className="shopping-list-price-age"> · {t(item.priceAgeMonths === 1 ? 'shoppingList.priceAgeOne' : 'shoppingList.priceAgeMany', { n: item.priceAgeMonths })}</span>
                    )}
                  </span>
                )}
                {healthBadge(item)}
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

      {/* Докупити в межах бюджету: вкладки «вручну / автопідбір» + режим ліміту (сума / позиції) */}
      <div className="card shopping-budget">
        <h3>{t('shoppingList.budgetTitle')}</h3>
        {toBuy.length === 0 ? (
          // Порожній список: докуповувати нема чого — мʼяко повідомляємо, нічого не забороняємо
          <p className="placeholder-text">{t('shoppingList.budgetListEmpty')}</p>
        ) : (
          <>
            {/* Крок 1: спершу ліміт — кількість позицій (або грн, якщо відомо достатньо цін) */}
            {pricesScarce ? (
              <p className="placeholder-text">{t('shoppingList.budgetCountNote')}</p>
            ) : (
              <div className="shopping-budget-modes">
                <button type="button" className={budgetMode === 'count' ? 'pill pill--active' : 'pill'} onClick={() => setBudgetMode('count')}>
                  {t('shoppingList.budgetModeCount')}
                </button>
                <button type="button" className={budgetMode === 'sum' ? 'pill pill--active' : 'pill'} onClick={() => setBudgetMode('sum')}>
                  {t('shoppingList.budgetModeSum')}
                </button>
              </div>
            )}

            <label className="shopping-check-field">
              <span>{mode === 'count' ? t('shoppingList.budgetCountLabel') : t('shoppingList.budgetSumLabel')}</span>
              <NumberStepper min={0} max={RANGES.money.max} value={budget} onChange={(v) => setBudget(v)} />
            </label>

            {/* Крок 2: після ліміту — обрати вручну чи автоматично */}
            <div className="shopping-budget-tabs">
              <button type="button" className={budgetTab === 'manual' ? 'pill pill--active' : 'pill'} onClick={() => setBudgetTab('manual')}>
                {t('shoppingList.budgetTabManual')}
              </button>
              <button type="button" className={budgetTab === 'auto' ? 'pill pill--active' : 'pill'} onClick={() => setBudgetTab('auto')}>
                {t('shoppingList.budgetTabAuto')}
              </button>
            </div>

            {budgetTab === 'manual' ? (
              <>
                {/* Фільтр за розділом + підкатегорією (напр. їжа → овочі) */}
                <div className="shopping-manual-filter">
                  <div className="shopping-budget-tabs">
                    <button type="button" className={manualSection === 'all' ? 'pill pill--active' : 'pill'} onClick={() => { setManualSection('all'); setManualCategory('all') }}>
                      {t('shoppingList.manualFilterAll')}
                    </button>
                    {manualSections.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        className={manualSection === s.key ? 'pill pill--active' : 'pill'}
                        onClick={() => { setManualSection(s.key); setManualCategory('all') }}
                      >
                        {sectionName(s.key, language)}
                      </button>
                    ))}
                  </div>
                  {manualCategories.length > 1 && (
                    <div className="shopping-budget-tabs shopping-manual-subfilter">
                      <button type="button" className={manualCategory === 'all' ? 'pill pill--active' : 'pill'} onClick={() => setManualCategory('all')}>
                        {t('shoppingList.manualFilterAll')}
                      </button>
                      {manualCategories.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          className={manualCategory === c.key ? 'pill pill--active' : 'pill'}
                          onClick={() => setManualCategory(c.key)}
                        >
                          {language === 'en' ? c.en : c.uk}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Ручний відбір: користувач сам ставить галочки серед наявного, бачить підсумок */}
                <ul className="shopping-budget-pick">
                  {manualItems.map((x) => (
                    <li key={x.id}>
                      <label className="shopping-budget-pick-item">
                        <input type="checkbox" checked={picked.has(x.id)} onChange={() => togglePick(x.id)} />
                        <span>{displayName(x)}</span>
                      </label>
                      <span className="shopping-budget-pick-meta">
                        {healthBadge(x)}
                        {x.estimatedPrice != null && (
                          <span className="shopping-list-price">{x.estimatedPrice} {currency}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {picked.size > 0 && (
                  <p className={overLimit ? 'shopping-list-total shopping-over' : 'shopping-list-total'}>
                    {mode === 'count'
                      ? t('shoppingList.budgetPickedCount', { count: pickedItems.length })
                      : t('shoppingList.budgetPickedSum', { sum: pickedSum })}
                    {overLimit && <span> · {t('shoppingList.budgetOverLimit')}</span>}
                  </p>
                )}
              </>
            ) : mode === 'sum' ? (
              <>
                {/* Автопідбір за сумою: ВСІ максимальні комбінації під бюджет (як у демоверсії).
                    Клік обирає бажаний варіант — він піднімається нагору й підсвічується; перші ~5
                    видно, решту гортаємо. */}
                {limit > 0 && (
                  <div className="shopping-combos-scroll">
                    <ComboList
                      combos={combos}
                      t={t}
                      nameFor={(i) => i.name}
                      keyFor={(i) => i.id}
                      emptyText={t('shoppingList.budgetEmpty')}
                      selectedKey={selectedComboKey}
                      onSelect={setSelectedComboKey}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Автопідбір за кількістю: усі комбінації рівно з N позицій (як у демоверсії),
                    а не перші N зі списку. Кількість варіантів обмежена, щоб не підвісити вкладку. */}
                <p className="placeholder-text">{t('shoppingList.budgetAutoMax', { max: MAX_AUTO_ITEMS })}</p>
                {limit > 0 && (
                  <div className="shopping-combos-scroll">
                    <ComboList
                      combos={countCombos}
                      t={t}
                      nameFor={(i) => i.name}
                      keyFor={(i) => i.id}
                      emptyText={t('shoppingList.budgetEmpty')}
                      selectedKey={selectedComboKey}
                      onSelect={setSelectedComboKey}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Запланувати похід у магазин: дата й час обовʼязкові → задача одразу на конкретний день
          і час. Поле й кнопка — горизонтально в один рівень. Порожній список не блокує, лише
          мʼяко попереджає. */}
      <div className="card shopping-trip">
        <div className="shopping-trip-row">
          <label className="shopping-check-field shopping-trip-date">
            <span>{t('shoppingList.tripDateLabel')}</span>
            <input
              type="datetime-local"
              value={tripDate}
              min={tripMin}
              max={tripMax}
              onChange={(e) => { setTripDate(e.target.value); setTripPlanned(false); setTripError('') }}
            />
          </label>
          <button type="button" className="btn-accent" onClick={handlePlanTrip}>
            <Icon name="cart" /> {t('shoppingList.planTrip')}
          </button>
        </div>
        {tripError && <p className="shopping-lang-hint">{tripError}</p>}
        {items.length === 0 && (
          <p className="placeholder-text">{t('shoppingList.planTripEmpty')}</p>
        )}
        {tripPlanned && (
          <p className="placeholder-text">
            {t('shoppingList.planTripDoneDated', { date: tripDate.replace('T', ', ') })}
          </p>
        )}
      </div>
    </div>
  )
}
