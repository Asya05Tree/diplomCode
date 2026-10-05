import { useState } from 'react'
import { useI18n } from '../i18n'
import { getFinanceBalance, setFinanceBalance } from '../utils/finance'
import './Landing.css'
import './Finance.css'

// Мінімальний модуль "Фінанси" (planner-spec.md §3.6 FinanceAccount) — єдиний баланс,
// який користувач вводить вручну; інші модулі (список покупок тощо) лише читають його.
export default function Finance() {
  const { t } = useI18n()
  const [balance, setBalance] = useState(() => getFinanceBalance())

  const handleChange = (e) => {
    const value = Math.max(0, Number(e.target.value) || 0)
    setBalance(value)
    setFinanceBalance(value)
  }

  return (
    <div className="finance-page">
      <h2>{t('nav.finance')}</h2>
      <label className="finance-balance-field">
        <span className="landing-panel-title">{t('finance.balanceLabel')}</span>
        <div className="landing-money-field">
          <input type="number" min="0" value={balance} onChange={handleChange} />
          <span className="landing-money-currency">{t('landing.moneyCurrency')}</span>
        </div>
      </label>
      <p className="landing-panel-hint">{t('finance.balanceHint')}</p>
    </div>
  )
}
