// Спільний рендер списку комбінацій ("А + Б, або В") — Landing (демо) і вкладка
// "Можливі варіанти покупки" у формі задачі "Піти в магазин" показують результат однаково.
// Якщо передано onSelect — варіанти стають клікабельними, а обраний (активний) піднімається
// нагору й підсвічується (ShoppingList: користувач обирає бажаний набір).
export default function ComboList({ combos, t, nameFor, keyFor = (item) => item.key, emptyText, selectedKey, onSelect }) {
  if (combos.length === 0) {
    return <p className="placeholder-text">{emptyText}</p>
  }
  const comboKey = (combo) => combo.items.map(keyFor).join('-')
  // Активний варіант — зверху (стабільне сортування решти збережено).
  const ordered = selectedKey
    ? [...combos].sort((a, b) => (comboKey(a) === selectedKey ? -1 : comboKey(b) === selectedKey ? 1 : 0))
    : combos

  const renderCombo = (combo) => {
    const parts = []
    combo.items.forEach((item, itemIndex) => {
      if (itemIndex > 0) {
        parts.push(
          <span key={`plus-${keyFor(item)}`} className="landing-results-plus">
            +
          </span>,
        )
      }
      parts.push(
        <span key={keyFor(item)} className="landing-results-combo-item">
          {nameFor(item)}
        </span>,
      )
    })
    return <div className="landing-results-combo">{parts}</div>
  }

  return (
    <ul className="landing-results-list">
      {ordered.map((combo, index) => {
        const ck = comboKey(combo)
        const isActive = Boolean(selectedKey) && ck === selectedKey
        return (
          <li
            key={ck}
            className={isActive ? 'landing-results-item landing-results-item--active' : 'landing-results-item'}
          >
            {index > 0 && <div className="landing-results-divider">{t('landing.resultsOr')}</div>}
            {onSelect ? (
              <button
                type="button"
                className={isActive ? 'landing-results-select landing-results-select--active' : 'landing-results-select'}
                onClick={() => onSelect(isActive ? null : ck)}
                aria-pressed={isActive}
              >
                {renderCombo(combo)}
              </button>
            ) : (
              renderCombo(combo)
            )}
          </li>
        )
      })}
    </ul>
  )
}
