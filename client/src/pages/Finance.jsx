import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import NumberStepper from '../components/NumberStepper'
import {
  getFinance,
  setBalance as apiSetBalance,
  setLimit as apiSetLimit,
  addTransaction as apiAddTransaction,
  removeTransaction as apiRemoveTransaction,
} from '../api/finance'
import './Finance.css'

// Пробіл-роздільник тисяч ("18 450") — як у макеті фінансів.
function formatMoney(value) {
  return String(Math.abs(Math.round(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// occurredAt — datetime-рядок із бекенда ("2026-10-18T09:30:00"). Показуємо лише дату DD.MM.YYYY.
function formatDate(occurredAt) {
  if (!occurredAt) return '—'
  const [y, m, d] = occurredAt.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

// Модуль "Фінанси" (planner-spec.md §3.6). Баланс — єдине значення, яке користувач вводить
// вручну (інші модулі лише читають його); нижче — історія операцій (з можливістю додати/видалити)
// та періодичні ліміти (тиждень / місяць). Дані — з бекенда (/api/finance).
export default function Finance() {
  const { t } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [balance, setBalance] = useState(0)
  const [limits, setLimits] = useState([]) // [{periodType, amount}]
  const [transactions, setTransactions] = useState([])

  const [tab, setTab] = useState('transactions') // 'transactions' | 'limits'

  // Форма додавання операції.
  const [form, setForm] = useState({ amount: '', type: 'Expense', category: '', description: '' })

  // Локальний стан полів лімітів (щоб редагувати перед збереженням).
  const [weekLimit, setWeekLimit] = useState('')
  const [monthLimit, setMonthLimit] = useState('')

  const currency = t('landing.moneyCurrency')

  const applyData = (fin) => {
    setBalance(Math.round(Number(fin?.balance) || 0))
    setLimits(fin?.limits ?? [])
    setTransactions(fin?.transactions ?? [])
    const wk = (fin?.limits ?? []).find((l) => l.periodType === 'Week')
    const mo = (fin?.limits ?? []).find((l) => l.periodType === 'Month')
    setWeekLimit(wk ? String(wk.amount) : '')
    setMonthLimit(mo ? String(mo.amount) : '')
  }

  useEffect(() => {
    let cancelled = false
    getFinance()
      .then((fin) => {
        if (cancelled) return
        applyData(fin)
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

  const refetch = async () => {
    const fin = await getFinance()
    applyData(fin)
  }

  const handleBalanceChange = (v) => {
    const value = Math.max(0, Math.round(Number(v) || 0))
    setBalance(value)
    apiSetBalance(value).catch(() => {})
  }

  const handleAddTransaction = async (e) => {
    e.preventDefault()
    const amount = Math.round(Number(form.amount) || 0)
    if (amount <= 0) return
    await apiAddTransaction({
      amount,
      type: form.type,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
    })
    setForm({ amount: '', type: 'Expense', category: '', description: '' })
    await refetch()
  }

  const handleRemoveTransaction = async (id) => {
    setTransactions((prev) => prev.filter((x) => x.id !== id))
    await apiRemoveTransaction(id)
    await refetch()
  }

  const handleSaveLimit = async (periodType, value) => {
    const amount = Math.max(0, Math.round(Number(value) || 0))
    await apiSetLimit(periodType, amount)
    await refetch()
  }

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const txn of transactions) {
      if (txn.type === 'Income') income += txn.amount
      else expense += txn.amount
    }
    return { income, expense }
  }, [transactions])

  if (loading) {
    return (
      <div className="finance-page">
        <p className="placeholder-text">{t('common.loading')}</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="finance-page">
        <p className="placeholder-text">{t('common.error')}</p>
      </div>
    )
  }

  const TABS = [
    { key: 'transactions', label: t('finance.tab.transactions'), icon: 'receipt' },
    { key: 'limits', label: t('finance.tab.limits'), icon: 'tag' },
  ]

  return (
    <div className="finance-page">
      <div className="page-head">
        <h2>{t('nav.finance')}</h2>
      </div>

      <label className="finance-balance-field card">
        <span className="kpi-label">{t('finance.balanceLabel')}</span>
        <div className="finance-money-field">
          <NumberStepper min={0} value={String(balance)} onChange={handleBalanceChange} />
          <span className="finance-money-currency">{currency}</span>
        </div>
        <span className="placeholder-text">{t('finance.balanceHint')}</span>
      </label>

      <div className="finance-tabs-nav">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'finance-tab-btn finance-tab-btn--active' : 'finance-tab-btn'}
            onClick={() => setTab(item.key)}
          >
            <Icon name={item.icon} className="finance-tab-icon" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <div className="card">
          <form className="finance-txn-form" onSubmit={handleAddTransaction}>
            <div className="finance-field">
              <span className="finance-field-label">{t('finance.amountLabel')}</span>
              <NumberStepper
                min={0}
                value={form.amount}
                onChange={(v) => setForm((f) => ({ ...f, amount: v }))}
                placeholder="0"
              />
            </div>
            <div className="finance-field">
              <span className="finance-field-label">{t('finance.typeLabel')}</span>
              <select
                className="finance-select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="Expense">{t('finance.type.expense')}</option>
                <option value="Income">{t('finance.type.income')}</option>
              </select>
            </div>
            <div className="finance-field">
              <span className="finance-field-label">{t('finance.col.category')}</span>
              <input
                type="text"
                className="finance-text"
                value={form.category}
                placeholder={t('finance.categoryPlaceholder')}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="finance-field finance-field--grow">
              <span className="finance-field-label">{t('finance.col.description')}</span>
              <input
                type="text"
                className="finance-text"
                value={form.description}
                placeholder={t('finance.descriptionPlaceholder')}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn-accent finance-add-btn">
              <Icon name="plus" /> {t('finance.addTransaction')}
            </button>
          </form>

          {transactions.length === 0 ? (
            <p className="placeholder-text">{t('finance.noTransactions')}</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('finance.col.date')}</th>
                    <th>{t('finance.col.category')}</th>
                    <th>{t('finance.col.description')}</th>
                    <th>{t('finance.col.amount')}</th>
                    <th className="finance-col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => {
                    const kind = txn.type === 'Income' ? 'income' : 'expense'
                    return (
                      <tr key={txn.id}>
                        <td>{formatDate(txn.occurredAt)}</td>
                        <td>{txn.category || <span className="none-text">—</span>}</td>
                        <td>{txn.description || <span className="none-text">—</span>}</td>
                        <td>
                          <span className={`txn-amount txn-amount--${kind}`}>
                            {txn.type === 'Income' ? '+' : '−'}{formatMoney(txn.amount)} {currency}
                          </span>
                        </td>
                        <td className="finance-col-actions">
                          <button
                            type="button"
                            className="finance-del"
                            onClick={() => handleRemoveTransaction(txn.id)}
                            aria-label={t('common.delete')}
                            data-tooltip={t('common.delete')}
                          >
                            <Icon name="trash" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="finance-txn-totals">
                <span className="txn-amount txn-amount--income">+{formatMoney(totals.income)} {currency}</span>
                <span className="txn-amount txn-amount--expense">−{formatMoney(totals.expense)} {currency}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'limits' && (
        <div className="card finance-limits">
          <p className="placeholder-text">{t('finance.limitsHint')}</p>
          <div className="finance-limit-row">
            <span className="finance-limit-label">{t('finance.limitWeek')}</span>
            <NumberStepper min={0} value={weekLimit} onChange={setWeekLimit} placeholder="0" />
            <span className="amount-unit">{currency}</span>
            <button type="button" className="btn-accent" onClick={() => handleSaveLimit('Week', weekLimit)}>
              {t('finance.saveLimit')}
            </button>
          </div>
          <div className="finance-limit-row">
            <span className="finance-limit-label">{t('finance.limitMonth')}</span>
            <NumberStepper min={0} value={monthLimit} onChange={setMonthLimit} placeholder="0" />
            <span className="amount-unit">{currency}</span>
            <button type="button" className="btn-accent" onClick={() => handleSaveLimit('Month', monthLimit)}>
              {t('finance.saveLimit')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
