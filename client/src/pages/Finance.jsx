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
  updateTransaction as apiUpdateTransaction,
  removeTransaction as apiRemoveTransaction,
  setCategoryHidden as apiSetCategoryHidden,
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

// Один тижневий графік (витрати / доходи / баланс). Для «баланс» signed=true — стовпці зі знаком
// і кольором (+ зелений / − червоний); масштаб — за найбільшим модулем у наборі.
function WeekChart({ weeks, signed, currentWeekIdx, t }) {
  const max = Math.max(1, ...weeks.map((w) => Math.abs(Number(w.amount) || 0)))
  const hasData = weeks.some((w) => Number(w.amount) !== 0)
  if (!hasData) return <p className="placeholder-text">{t('finance.statsEmpty')}</p>
  return (
    <div className="week-chart">
      {weeks.map((w, i) => {
        const val = Number(w.amount) || 0
        const neg = signed && val < 0
        const pos = signed && val > 0
        return (
          <div key={w.week} className="week-chart-col">
            <span className={`week-chart-amount${neg ? ' week-chart-amount--neg' : pos ? ' week-chart-amount--pos' : ''}`}>
              {pos ? '+' : neg ? '−' : ''}{formatMoney(val)}
            </span>
            <div
              className={`week-chart-bar${neg ? ' week-chart-bar--neg' : pos ? ' week-chart-bar--pos' : ''}`}
              style={{ height: `${Math.round((Math.abs(val) / max) * 120)}px` }}
            />
            <span className="week-chart-label">
              {i === currentWeekIdx ? t('finance.weekCurrent', { n: w.week }) : t('finance.weekShort', { n: w.week })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Модуль "Фінанси" (planner-spec.md §3.6). Баланс («Наявні гроші») вводиться вручну зверху;
// нижче — вкладки Категорії (активні/сховані, швидкий ввід +дохід/−витрата, «Є зараз»), Історія
// (список операцій із редагуванням) і Статистика (тижнева динаміка витрат/доходів/балансу).
export default function Finance() {
  const { t, language } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [categoryNets, setCategoryNets] = useState([]) // [{category, net}]
  const [hiddenCategories, setHiddenCategories] = useState([]) // [key]

  const [tab, setTab] = useState('categories') // 'categories' | 'history' | 'stats'
  const [drafts, setDrafts] = useState({}) // "key_income" / "key_expense" -> рядок

  // Редагування операції в історії
  const [editId, setEditId] = useState(null)
  const [editDraft, setEditDraft] = useState({ amount: '', type: 'Expense', category: '', description: '' })

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
    setHiddenCategories(fin?.hiddenCategories ?? [])
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

  const hiddenSet = useMemo(() => new Set(hiddenCategories), [hiddenCategories])
  const activeCats = FINANCE_CATEGORIES.filter((c) => !hiddenSet.has(c.key))
  const hiddenCats = FINANCE_CATEGORIES.filter((c) => hiddenSet.has(c.key))

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

  const handleToggleHidden = async (key, hidden) => {
    await apiSetCategoryHidden(key, hidden)
    await refetch()
  }

  const handleRemoveTransaction = async (id) => {
    if (editId === id) cancelEdit()
    setTransactions((prev) => prev.filter((x) => x.id !== id))
    await apiRemoveTransaction(id)
    await refetch()
  }

  const startEdit = (txn) => {
    setEditId(txn.id)
    setEditDraft({
      amount: String(Math.round(Number(txn.amount) || 0)),
      type: txn.type,
      category: txn.category || '',
      description: txn.description || '',
    })
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditDraft({ amount: '', type: 'Expense', category: '', description: '' })
  }

  const saveEdit = async () => {
    const amount = Math.min(RANGES.money.max, Math.round((Number(sanitizeMoney(editDraft.amount)) || 0) * 100) / 100)
    if (!(amount > 0)) return
    const id = editId
    await apiUpdateTransaction(id, {
      amount,
      type: editDraft.type,
      category: editDraft.category || null,
      description: editDraft.description.trim() || null,
    })
    cancelEdit()
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

  const isCurrentMonth = statsYear === now.getFullYear() && statsMonth === now.getMonth() + 1
  const currentWeekIdx = isCurrentMonth ? Math.min(3, Math.floor((now.getDate() - 1) / 7)) : -1

  // Рядок таблиці активних категорій (із швидким вводом +дохід/−витрата)
  const renderActiveRow = (c) => {
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
                <span className={`amount-sign amount-sign--${field}`}>{type === 'Income' ? '+' : '−'}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={drafts[draftKey] || ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [draftKey]: sanitizeMoney(e.target.value) }))}
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
        <td className="finance-col-actions">
          <button
            type="button"
            className="finance-cat-toggle"
            onClick={() => handleToggleHidden(c.key, true)}
            data-tooltip={t('finance.hideCategory')}
          >
            {t('finance.hide')}
          </button>
        </td>
      </tr>
    )
  }

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
          <p className="placeholder-text">{t('finance.activeHint')}</p>
          <div className="table-scroll">
            <table className="data-table finance-cat-table">
              <thead>
                <tr>
                  <th>{t('finance.col.category')}</th>
                  <th>{t('finance.col.income')}</th>
                  <th>{t('finance.col.expense')}</th>
                  <th>{t('finance.col.current')}</th>
                  <th className="finance-col-actions" />
                </tr>
              </thead>
              <tbody>{activeCats.map(renderActiveRow)}</tbody>
            </table>
          </div>

          {hiddenCats.length > 0 && (
            <div className="finance-hidden-block">
              <h3 className="finance-sub-title">{t('finance.hiddenTitle')}</h3>
              <p className="placeholder-text">{t('finance.hiddenHint')}</p>
              <div className="table-scroll">
                <table className="data-table finance-hidden-table">
                  <thead>
                    <tr>
                      <th>{t('finance.col.category')}</th>
                      <th>{t('finance.col.current')}</th>
                      <th className="finance-col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {hiddenCats.map((c) => {
                      const net = netByKey.get(c.key) || 0
                      const netCls = net > 0 ? 'income' : net < 0 ? 'expense' : 'zero'
                      return (
                        <tr key={c.key} className="finance-row-hidden">
                          <td>
                            <span className="finance-cat-name">
                              <span className="cat-dot" style={{ background: c.color }} />
                              {categoryName(c.key, language)}
                            </span>
                          </td>
                          <td>
                            <span className={`fin-net fin-net--${netCls}`}>
                              {net < 0 ? '−' : ''}
                              {formatMoney(net)} {currency}
                            </span>
                          </td>
                          <td className="finance-col-actions">
                            <button
                              type="button"
                              className="finance-cat-toggle finance-cat-toggle--restore"
                              onClick={() => handleToggleHidden(c.key, false)}
                            >
                              {t('finance.restore')}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
                    if (editId === txn.id) {
                      return (
                        <tr key={txn.id} className="finance-row-editing">
                          <td>
                            <span className="amount-input">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editDraft.amount}
                                onChange={(e) => setEditDraft((d) => ({ ...d, amount: sanitizeMoney(e.target.value) }))}
                              />
                              <span className="amount-unit">{currency}</span>
                            </span>
                            <select
                              className="finance-edit-type"
                              value={editDraft.type}
                              onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                            >
                              <option value="Income">{t('finance.type.income')}</option>
                              <option value="Expense">{t('finance.type.expense')}</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editDraft.description}
                              placeholder={t('finance.col.description')}
                              maxLength={120}
                              onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                            />
                          </td>
                          <td>
                            <select
                              value={editDraft.category}
                              onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                            >
                              <option value="">—</option>
                              {FINANCE_CATEGORIES.map((c) => (
                                <option key={c.key} value={c.key}>
                                  {categoryName(c.key, language)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{formatDate(txn.occurredAt)}</td>
                          <td className="finance-col-actions">
                            <button type="button" className="finance-edit-save" onClick={saveEdit}>
                              {t('common.save')}
                            </button>
                            <button type="button" className="finance-edit-cancel" onClick={cancelEdit}>
                              {t('common.cancel')}
                            </button>
                          </td>
                        </tr>
                      )
                    }
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
                            className="finance-edit"
                            onClick={() => startEdit(txn)}
                            aria-label={t('common.edit')}
                            data-tooltip={t('common.edit')}
                          >
                            <Icon name="pencil" />
                          </button>
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

          {stats ? (
            <div className="finance-stats-stack">
              <section className="finance-stats-section">
                <h4 className="finance-stats-caption">{t('finance.statsExpense')}</h4>
                <WeekChart weeks={stats.expenseWeeks} currentWeekIdx={currentWeekIdx} t={t} />
                <div className="week-chart-avg">
                  <span>{t('finance.statsAvgExpense')}</span>
                  <strong>{formatMoney(stats.expenseAverage)} {currency}</strong>
                </div>
              </section>

              <section className="finance-stats-section">
                <h4 className="finance-stats-caption">{t('finance.statsIncome')}</h4>
                <WeekChart weeks={stats.incomeWeeks} currentWeekIdx={currentWeekIdx} t={t} />
                <div className="week-chart-avg">
                  <span>{t('finance.statsAvgIncome')}</span>
                  <strong>{formatMoney(stats.incomeAverage)} {currency}</strong>
                </div>
              </section>

              <section className="finance-stats-section">
                <h4 className="finance-stats-caption">{t('finance.statsNet')}</h4>
                <WeekChart weeks={stats.netWeeks} signed currentWeekIdx={currentWeekIdx} t={t} />
              </section>
            </div>
          ) : (
            <p className="placeholder-text">{t('finance.statsEmpty')}</p>
          )}
        </div>
      )}
    </div>
  )
}
