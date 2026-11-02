import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import NumberStepper from '../components/NumberStepper'
import { FINANCE_CATEGORIES, categoryName } from '../utils/financeCategories'
import { RANGES } from '../utils/validation'
import {
  getFinance,
  getStats,
  setBalance as apiSetBalance,
  addTransaction as apiAddTransaction,
  removeTransaction as apiRemoveTransaction,
} from '../api/finance'
import './Finance.css'

const MONTHS = {
  uk: ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

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

// Лишаємо лише цифри й один роздільник (швидкий ввід сум у таблиці категорій).
function sanitizeMoney(s) {
  return String(s).replace(/[^\d.,]/g, '').replace(',', '.').replace(/(\..*)\./g, '$1')
}

// Модуль "Фінанси" (planner-spec.md §3.6). Баланс («Наявні гроші») вводиться вручну зверху;
// нижче — вкладки Категорії (швидкий ввід +дохід/−витрата, «Є зараз» по категорії), Історія
// (список операцій) і Статистика (тижнева динаміка витрат). Дані — з бекенда (/api/finance).
export default function Finance() {
  const { t, language } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [categoryNets, setCategoryNets] = useState([]) // [{category, net}]

  const [tab, setTab] = useState('categories') // 'categories' | 'history' | 'stats'
  const [drafts, setDrafts] = useState({}) // "key_income" / "key_expense" -> рядок

  // Статистика: обраний місяць (за замовчуванням поточний) + дані з бекенда.
  const now = useMemo(() => new Date(), [])
  const [statsYear, setStatsYear] = useState(now.getFullYear())
  const [statsMonth, setStatsMonth] = useState(now.getMonth() + 1) // 1..12
  const [stats, setStats] = useState(null)

  const currency = t('landing.moneyCurrency')

  const applyData = (fin) => {
    setBalance(Math.round(Number(fin?.balance) || 0))
    setTransactions(fin?.transactions ?? [])
    setCategoryNets(fin?.categoryNets ?? [])
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

  // Статистику тягнемо, коли відкрита її вкладка або змінився місяць
  useEffect(() => {
    if (tab !== 'stats') return
    let cancelled = false
    getStats(statsYear, statsMonth)
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
    return () => {
      cancelled = true
    }
  }, [tab, statsYear, statsMonth])

  const refetch = async () => {
    const fin = await getFinance()
    applyData(fin)
  }

  const handleBalanceChange = (v) => {
    const value = Math.min(RANGES.money.max, Math.max(0, Math.round(Number(v) || 0)))
    setBalance(value)
    apiSetBalance(value).catch(() => {})
  }

  const netByKey = useMemo(() => {
    const map = new Map()
    for (const c of categoryNets) map.set(c.category, Number(c.net) || 0)
    return map
  }, [categoryNets])

  // Швидкий ввід суми по категорії → додає операцію (дата = сьогодні на бекенді)
  const commitQuick = async (key, type) => {
    const field = type === 'Income' ? 'income' : 'expense'
    const draftKey = `${key}_${field}`
    const amount = Math.min(RANGES.money.max, Math.round((Number(drafts[draftKey]) || 0) * 100) / 100)
    if (!(amount > 0)) {
      setDrafts((d) => ({ ...d, [draftKey]: '' }))
      return
    }
    await apiAddTransaction({ amount, type, category: key })
    setDrafts((d) => ({ ...d, [draftKey]: '' }))
    await refetch()
  }

  const handleRemoveTransaction = async (id) => {
    setTransactions((prev) => prev.filter((x) => x.id !== id))
    await apiRemoveTransaction(id)
    await refetch()
  }

  const stepMonth = (delta) => {
    let m = statsMonth + delta
    let y = statsYear
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setStatsMonth(m)
    setStatsYear(y)
  }

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
    { key: 'categories', label: t('finance.tab.categories'), icon: 'tag' },
    { key: 'history', label: t('finance.tab.history'), icon: 'receipt' },
    { key: 'stats', label: t('finance.tab.stats'), icon: 'chart' },
  ]

  const maxWeek = stats ? Math.max(1, ...stats.weeks.map((w) => Number(w.amount) || 0)) : 1
  const isCurrentMonth = statsYear === now.getFullYear() && statsMonth === now.getMonth() + 1
  const currentWeekIdx = isCurrentMonth ? Math.min(3, Math.floor((now.getDate() - 1) / 7)) : -1

  return (
    <div className="finance-page">
      <div className="page-head">
        <h2>{t('nav.finance')}</h2>
      </div>

      <label className="finance-balance-field card">
        <span className="kpi-label">{t('finance.balanceLabel')}</span>
        <div className="finance-money-field">
          <NumberStepper min={0} max={RANGES.money.max} value={String(balance)} onChange={handleBalanceChange} />
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

      {tab === 'categories' && (
        <div className="card">
          <p className="placeholder-text">{t('finance.categoriesHint')}</p>
          <div className="table-scroll">
            <table className="data-table finance-cat-table">
              <thead>
                <tr>
                  <th>{t('finance.col.category')}</th>
                  <th>{t('finance.col.income')}</th>
                  <th>{t('finance.col.expense')}</th>
                  <th>{t('finance.col.current')}</th>
                </tr>
              </thead>
              <tbody>
                {FINANCE_CATEGORIES.map((c) => {
                  const net = netByKey.get(c.key) || 0
                  const netCls = net > 0 ? 'income' : net < 0 ? 'expense' : 'zero'
                  return (
                    <tr key={c.key}>
                      <td>
                        <span className="finance-cat-name">
                          <span className="cat-dot" style={{ background: c.color }} />
                          {categoryName(c.key, language)}
                        </span>
                      </td>
                      {['Income', 'Expense'].map((type) => {
                        const field = type === 'Income' ? 'income' : 'expense'
                        const draftKey = `${c.key}_${field}`
                        return (
                          <td key={type}>
                            <span className="amount-input">
                              <span className={`amount-sign amount-sign--${field}`}>
                                {type === 'Income' ? '+' : '−'}
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={drafts[draftKey] || ''}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [draftKey]: sanitizeMoney(e.target.value) }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    commitQuick(c.key, type)
                                  }
                                }}
                                onBlur={() => commitQuick(c.key, type)}
                              />
                              <span className="amount-unit">{currency}</span>
                            </span>
                          </td>
                        )
                      })}
                      <td>
                        <span className={`fin-net fin-net--${netCls}`}>
                          {net < 0 ? '−' : ''}
                          {formatMoney(net)} {currency}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          {transactions.length === 0 ? (
            <p className="placeholder-text">{t('finance.noTransactions')}</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('finance.col.amount')}</th>
                    <th>{t('finance.col.description')}</th>
                    <th>{t('finance.col.category')}</th>
                    <th>{t('finance.col.date')}</th>
                    <th className="finance-col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => {
                    const kind = txn.type === 'Income' ? 'income' : 'expense'
                    return (
                      <tr key={txn.id}>
                        <td>
                          <span className={`txn-amount txn-amount--${kind}`}>
                            {txn.type === 'Income' ? '+' : '−'}
                            {formatMoney(txn.amount)} {currency}
                          </span>
                        </td>
                        <td>{txn.description || <span className="none-text">—</span>}</td>
                        <td>{txn.category ? categoryName(txn.category, language) : <span className="none-text">—</span>}</td>
                        <td>{formatDate(txn.occurredAt)}</td>
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
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div className="card">
          <div className="week-chart-head">
            <h3>{t('finance.statsTitle')}</h3>
            <div className="period-picker">
              <button type="button" className="period-step" onClick={() => stepMonth(-1)} aria-label="−">
                <Icon name="chevron-left" />
              </button>
              <span className="period-label">
                {MONTHS[language === 'en' ? 'en' : 'uk'][statsMonth - 1]} {statsYear}
              </span>
              <button type="button" className="period-step" onClick={() => stepMonth(1)} aria-label="+">
                <Icon name="chevron-right" />
              </button>
            </div>
          </div>

          {stats && stats.weeks.some((w) => Number(w.amount) > 0) ? (
            <>
              <div className="week-chart">
                {stats.weeks.map((w, i) => (
                  <div key={w.week} className="week-chart-col">
                    <span className="week-chart-amount">{formatMoney(w.amount)}</span>
                    <div
                      className="week-chart-bar"
                      style={{ height: `${Math.round((Number(w.amount) / maxWeek) * 120)}px` }}
                    />
                    <span className="week-chart-label">
                      {i === currentWeekIdx ? t('finance.weekCurrent', { n: w.week }) : t('finance.weekShort', { n: w.week })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="week-chart-avg">
                <span>{t('finance.statsAvgLabel')}</span>
                <strong>{formatMoney(stats.average)} {currency}</strong>
              </div>
            </>
          ) : (
            <p className="placeholder-text">{t('finance.statsEmpty')}</p>
          )}
        </div>
      )}
    </div>
  )
}
