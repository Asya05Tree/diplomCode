import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import ComboList from '../common/ComboList'
import { findMaximalCombos } from '../../utils/combos'
import { getShoppingItems } from '../../utils/shoppingList'
import { getFinanceBalance } from '../../utils/finance'
import '../../pages/Landing.css'
import './ShoppingTaskTabs.css'

// Для задачі "Піти в магазин" замість опису — дві вкладки: сам список покупок (із посиланням
// на повноцінну сторінку списку) і демо підбору варіантів покупки під бюджет, за тим самим
// принципом "або", що й на Landing (там же — демонстрація того самого алгоритму findMaximalCombos).
// Сума грошей більше не вводиться тут окремо — вона завжди береться з розділу "Фінанси"
// (єдиний баланс на весь застосунок, planner-spec.md §3.6).
export default function ShoppingTaskTabs() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tab, setTab] = useState('list')
  const budget = getFinanceBalance()

  const items = useMemo(() => getShoppingItems(), [])
  const pricedItems = useMemo(() => items.filter((item) => !item.owned && item.price > 0), [items])

  const combos = useMemo(() => findMaximalCombos(pricedItems, budget), [pricedItems, budget])

  return (
    <div className="shopping-task-tabs">
      <div className="landing-tabs-bar">
        <button
          type="button"
          className={tab === 'list' ? 'landing-tab landing-tab--active' : 'landing-tab'}
          onClick={() => setTab('list')}
        >
          {t('taskForm.shoppingTab.list')}
        </button>
        <button
          type="button"
          className={tab === 'options' ? 'landing-tab landing-tab--active' : 'landing-tab'}
          onClick={() => setTab('options')}
        >
          {t('taskForm.shoppingTab.options')}
        </button>
      </div>

      {tab === 'list' ? (
        <div className="shopping-task-list">
          {items.length === 0 ? (
            <p className="placeholder-text">{t('shoppingList.empty')}</p>
          ) : (
            <ul className="landing-price-list">
              {items.map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  {item.price > 0 && (
                    <span className="landing-price-amount">
                      {item.price} {t('landing.moneyCurrency')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="task-form-submit" onClick={() => navigate('/app/shopping-list')}>
            {t('taskForm.goToShoppingList')}
          </button>
        </div>
      ) : (
        <div className="shopping-task-options">
          <p className="landing-panel-title">
            {t('taskForm.shoppingBudgetLabel')}: {budget} {t('landing.moneyCurrency')}
          </p>
          <button type="button" className="task-form-cancel" onClick={() => navigate('/app/finance')}>
            {t('taskForm.editInFinance')}
          </button>

          <ComboList
            combos={combos}
            t={t}
            nameFor={(item) => item.name}
            keyFor={(item) => item.id}
            emptyText={t('landing.shoppingResultsEmpty')}
          />
        </div>
      )}
    </div>
  )
}
