import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import {
  SHOPPING_CATEGORIES,
  addShoppingItem,
  detectCategory,
  getShoppingItems,
  removeShoppingItem,
  setShoppingItemCategory,
  setShoppingItemOwned,
} from '../utils/shoppingList'
import './ShoppingList.css'

// planner-spec.md §3.8 — список покупок. Категорія визначається за назвою автоматично
// (банан → їжа), а якщо система не впізнала слово — користувач обирає категорію сам
// через той самий випадаючий список (що й виконує роль хештега категорії).
export default function ShoppingList() {
  const { t } = useI18n()
  const [items, setItems] = useState(() => getShoppingItems())
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')

  const handleAdd = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    addShoppingItem(name, detectCategory(name), price)
    setItems(getShoppingItems())
    setName('')
    setPrice('')
  }

  const handleDelete = (id) => {
    removeShoppingItem(id)
    setItems(getShoppingItems())
  }

  const handleCategoryChange = (id, category) => {
    setShoppingItemCategory(id, category || null)
    setItems(getShoppingItems())
  }

  const handleOwnedToggle = (id, owned) => {
    setShoppingItemOwned(id, owned)
    setItems(getShoppingItems())
  }

  const grouped = useMemo(() => {
    const map = new Map()
    for (const category of SHOPPING_CATEGORIES) map.set(category, [])
    map.set('uncategorized', [])
    for (const item of items) {
      const key = item.category && map.has(item.category) ? item.category : 'uncategorized'
      map.get(key).push(item)
    }
    return Array.from(map.entries()).filter(([, list]) => list.length > 0)
  }, [items])

  // planner-spec.md §4.8 — "Итого" завжди чесно позначає, скільки позицій узято в суму:
  // те, що вже є вдома, і позиції без ціни в суму не входять.
  const toBuy = items.filter((item) => !item.owned)
  const priced = toBuy.filter((item) => item.price > 0)
  const total = priced.reduce((sum, item) => sum + item.price, 0)

  return (
    <div className="shopping-list-page">
      <h2>{t('shoppingList.title')}</h2>

      <form className="shopping-list-add card" onSubmit={handleAdd}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('shoppingList.addPlaceholder')}
        />
        <input
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={t('shoppingList.priceLabel')}
        />
        <button type="submit">{t('shoppingList.addButton')}</button>
      </form>

      {items.length === 0 ? (
        <p className="placeholder-text">{t('shoppingList.empty')}</p>
      ) : (
        <div className="shopping-list-groups">
          {grouped.map(([category, list]) => (
            <div key={category} className="card shopping-list-group">
              <h3>{t(`shoppingList.category.${category}`)}</h3>
              <ul>
                {list.map((item) => (
                  <li key={item.id} className={item.owned ? 'shopping-list-row is-owned' : 'shopping-list-row'}>
                    <label className="shopping-list-owned" title={t('shoppingList.ownedLabel')}>
                      <input
                        type="checkbox"
                        checked={item.owned}
                        onChange={(e) => handleOwnedToggle(item.id, e.target.checked)}
                      />
                    </label>
                    <span className="shopping-list-name">{item.name}</span>
                    {item.price > 0 && (
                      <span className="shopping-list-price">
                        {item.price} {t('landing.moneyCurrency')}
                      </span>
                    )}
                    <select
                      value={item.category ?? ''}
                      onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                    >
                      <option value="">{t('shoppingList.category.uncategorized')}</option>
                      {SHOPPING_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t(`shoppingList.category.${c}`)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="task-item-action task-item-action--danger"
                      onClick={() => handleDelete(item.id)}
                    >
                      {t('planner.actionDelete')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {toBuy.length > 0 && (
            <p className="shopping-list-total">
              {t('shoppingList.totalLabel', { amount: total, known: priced.length, total: toBuy.length })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
