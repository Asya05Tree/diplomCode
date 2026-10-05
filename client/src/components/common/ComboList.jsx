// Спільний рендер списку комбінацій ("А + Б, або В") — Landing (демо) і вкладка
// "Можливі варіанти покупки" у формі задачі "Піти в магазин" показують результат однаково.
export default function ComboList({ combos, t, nameFor, keyFor = (item) => item.key, emptyText }) {
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
        return (
          <li key={combo.items.map(keyFor).join('-')}>
            {index > 0 && <div className="landing-results-divider">{t('landing.resultsOr')}</div>}
            <div className="landing-results-combo">{parts}</div>
          </li>
        )
      })}
    </ul>
  )
}
