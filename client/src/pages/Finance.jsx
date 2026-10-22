import { useState } from 'react'
import { useI18n } from '../i18n'
import { getFinanceBalance, setFinanceBalance } from '../utils/finance'
import './Finance.css'

// Категорії (planner-spec.md §3.6). "current" — скільки витрачено/лишилось по категорії
// (демо-число), income/expense — ручні поля, які користувач заповнює сам (поки без бекенду).
const CATEGORIES = [
  { id: 1, color: 'var(--cat-color-1)', name: { uk: 'Житло й комунальні', en: 'Housing & utilities' }, current: 4200 },
  { id: 2, color: 'var(--cat-color-2)', name: { uk: 'Їжа', en: 'Food' }, current: 3100 },
  { id: 3, color: 'var(--cat-color-3)', name: { uk: 'Транспорт', en: 'Transport' }, current: 950 },
  { id: 4, color: 'var(--cat-color-4)', name: { uk: 'Розваги', en: 'Entertainment' }, current: 780 },
  { id: 5, color: 'var(--cat-color-5)', name: { uk: 'Аптечка', en: 'Medicine' }, current: 540 },
  { id: 6, color: 'var(--cat-color-6)', name: { uk: 'Одяг', en: 'Clothing' }, current: 1200 },
  { id: 7, color: 'var(--cat-color-7)', name: { uk: 'Освіта', en: 'Education' }, current: 900 },
  { id: 8, color: 'var(--cat-color-8)', name: { uk: 'Інше', en: 'Other' }, current: 330 },
]

// Історія операцій (planner-spec.md §3.6 FinanceTransaction) — демонстраційні записи.
const TRANSACTIONS = [
  { id: 1, amount: 32000, type: 'income', desc: { uk: 'Зарплата', en: 'Salary' }, category: { uk: 'Зарплата', en: 'Salary' }, date: '18.10.2026' },
  { id: 2, amount: -540, type: 'expense', desc: { uk: 'АТБ, продукти', en: 'ATB, groceries' }, category: { uk: 'Їжа', en: 'Food' }, date: '17.10.2026' },
  { id: 3, amount: -180, type: 'expense', desc: { uk: 'Таксі додому', en: 'Taxi home' }, category: { uk: 'Транспорт', en: 'Transport' }, date: '16.10.2026' },
  { id: 4, amount: -2150, type: 'expense', desc: { uk: 'Оплата комуналки', en: 'Utilities payment' }, category: { uk: 'Житло й комунальні', en: 'Housing & utilities' }, date: '15.10.2026' },
  { id: 5, amount: -420, type: 'expense', desc: { uk: 'Кіно з друзями', en: 'Movies with friends' }, category: { uk: 'Розваги', en: 'Entertainment' }, date: '14.10.2026' },
  { id: 6, amount: -310, type: 'expense', desc: null, category: { uk: 'Аптечка', en: 'Medicine' }, date: '12.10.2026' },
  { id: 7, amount: 4500, type: 'income', desc: { uk: 'Фріланс-проєкт', en: 'Freelance project' }, category: { uk: 'Підробіток', en: 'Side income' }, date: '10.10.2026' },
  { id: 8, amount: -2800, type: 'expense', desc: { uk: 'Зимова куртка', en: 'Winter jacket' }, category: { uk: 'Одяг', en: 'Clothing' }, date: '08.10.2026' },
  { id: 9, amount: -1200, type: 'expense', desc: null, category: { uk: 'Освіта', en: 'Education' }, date: '05.10.2026' },
  { id: 10, amount: 1000, type: 'income', desc: { uk: 'Повернення боргу', en: 'Debt repayment' }, category: { uk: 'Інше', en: 'Other' }, date: '02.10.2026' },
]

// Тижнева динаміка витрат (planner-spec.md §4.9) — демо-дані для простого стовпчикового графіка.
const WEEK_STATS = [
  { week: 1, value: 2100 },
  { week: 2, value: 3400 },
  { week: 3, value: 4200 },
  { week: 4, value: 2300, current: true },
]
const WEEK_MAX = 4200
const WEEK_AXIS = [4200, 3150, 2100, 1050, 0]
const WEEK_AVG = 3000

// Пробіл-роздільник тисяч ("18 450") — як у макеті фінансів.
function formatMoney(value) {
  return String(Math.abs(Math.round(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// Мінімальний модуль "Фінанси" (planner-spec.md §3.6). Баланс — єдине значення, яке
// користувач вводить вручну (інші модулі лише читають його); нижче — три вкладки
// (Категорії / Історія / Статистика) з демонстраційними даними.
export default function Finance() {
  const { t, language } = useI18n()
  const [balance, setBalance] = useState(() => getFinanceBalance())
  const [tab, setTab] = useState('categories') // 'categories' | 'history' | 'stats'
  // Ручні поля сум по категоріях — локальний стан (демо, поки без бекенду).
  const [amounts, setAmounts] = useState({})
  const currency = t('landing.moneyCurrency')

  const handleBalanceChange = (e) => {
    const value = Math.max(0, Number(e.target.value) || 0)
    setBalance(value)
    setFinanceBalance(value)
  }

  const handleAmountChange = (id, kind, value) => {
    setAmounts((prev) => ({ ...prev, [`${id}:${kind}`]: value }))
  }

  const TABS = [
    { key: 'categories', label: t('finance.tab.categories'), icon: '🏷️' },
    { key: 'history', label: t('finance.tab.history'), icon: '🧾' },
    { key: 'stats', label: t('finance.tab.stats'), icon: '📊' },
  ]

  return (
    <div className="finance-page">
      <div className="page-head">
        <h2>{t('nav.finance')}</h2>
        <span className="variant-note">{t('finance.note')}</span>
      </div>

      <label className="finance-balance-field card">
        <span className="kpi-label">{t('finance.balanceLabel')}</span>
        <div className="finance-money-field">
          <input type="number" min="0" value={balance} onChange={handleBalanceChange} />
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
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'categories' && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('finance.col.category')}</th>
                  <th>{t('finance.col.income')}</th>
                  <th>{t('finance.col.expense')}</th>
                  <th>{t('finance.col.current')}</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="finance-cat-name">
                        <span className="cat-dot" style={{ background: c.color }} />
                        {c.name[language]}
                      </span>
                    </td>
                    <td>
                      <span className="amount-input">
                        <span className="amount-sign amount-sign--income">+</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={amounts[`${c.id}:income`] ?? ''}
                          onChange={(e) => handleAmountChange(c.id, 'income', e.target.value)}
                        />
                        <span className="amount-unit">{currency}</span>
                      </span>
                    </td>
                    <td>
                      <span className="amount-input">
                        <span className="amount-sign amount-sign--expense">−</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={amounts[`${c.id}:expense`] ?? ''}
                          onChange={(e) => handleAmountChange(c.id, 'expense', e.target.value)}
                        />
                        <span className="amount-unit">{currency}</span>
                      </span>
                    </td>
                    <td>{formatMoney(c.current)} {currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'history' && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('finance.col.amount')}</th>
                  <th>{t('finance.col.description')}</th>
                  <th>{t('finance.col.category')}</th>
                  <th>{t('finance.col.date')}</th>
                </tr>
              </thead>
              <tbody>
                {TRANSACTIONS.map((txn) => (
                  <tr key={txn.id}>
                    <td>
                      <span className={`txn-amount txn-amount--${txn.type}`}>
                        {txn.type === 'income' ? '+' : '−'}{formatMoney(txn.amount)} {currency}
                      </span>
                    </td>
                    <td>{txn.desc ? txn.desc[language] : <span className="none-text">—</span>}</td>
                    <td>{txn.category[language]}</td>
                    <td>{txn.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'stats' && (
          <div>
            <div className="week-chart-head">
              <h3>{t('finance.statsTitle')}</h3>
              <span className="pill">📅 {t('finance.statsPeriod')}</span>
            </div>
            <div className="week-chart-row">
              <div className="week-axis">
                {WEEK_AXIS.map((v) => (
                  <span key={v}>{formatMoney(v)}</span>
                ))}
              </div>
              <div className="week-chart">
                {WEEK_STATS.map((w) => (
                  <div key={w.week} className="week-chart-col">
                    <span className="week-chart-amount">{formatMoney(w.value)}</span>
                    <div
                      className="week-chart-bar"
                      style={{ height: `${Math.round((w.value / WEEK_MAX) * 100)}%` }}
                    />
                    <span className="week-chart-label">
                      {w.current
                        ? t('finance.weekCurrent', { n: w.week })
                        : t('finance.weekShort', { n: w.week })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="week-chart-avg">
              <span>{t('finance.statsAvgLabel')}</span>
              <strong>{formatMoney(WEEK_AVG)} {currency}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
