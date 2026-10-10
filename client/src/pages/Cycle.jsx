import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { addDays, fromApiDate, todayApiDate } from '../utils/date'
import {
  computeForecast,
  deleteCycleRecord,
  getCycleRecords,
  getCycleSettings,
  getCycleStock,
  getOpenRecord,
  markCycleEnd,
  markCycleStart,
  setCycleStockState,
  setReduceLoadOnHeavyDays,
} from '../utils/cycle'
import { addShoppingItem } from '../utils/shoppingList'
import './Cycle.css'

function formatDate(apiDate) {
  return fromApiDate(apiDate).toLocaleDateString()
}

function formatDateObj(date) {
  return date.toLocaleDateString()
}

// planner-spec.md §3.7 — модуль "Цикл": тільки ручні відмітки початку/кінця, чесний прогноз
// (без діагнозів і порад звернутися до лікаря) і перевірка запасів до прогнозованої дати,
// яка переливається в спільний список покупок (§9 "цикл ↔ запаси").
export default function Cycle() {
  const { t } = useI18n()
  const [records, setRecords] = useState(() => getCycleRecords())
  const [settings, setSettings] = useState(() => getCycleSettings())
  const [stock, setStock] = useState(() => getCycleStock())
  const [addedIds, setAddedIds] = useState(() => new Set())

  const openRecord = getOpenRecord(records)
  const forecast = useMemo(() => computeForecast(records), [records])

  const handleMarkStart = () => {
    markCycleStart(todayApiDate())
    setRecords(getCycleRecords())
  }

  const handleMarkEnd = () => {
    if (!openRecord) return
    markCycleEnd(openRecord.id, todayApiDate())
    setRecords(getCycleRecords())
  }

  const handleDelete = (id) => {
    deleteCycleRecord(id)
    setRecords(getCycleRecords())
  }

  const handleToggleReduceLoad = (e) => {
    const value = e.target.checked
    setReduceLoadOnHeavyDays(value)
    setSettings(getCycleSettings())
  }

  const handleStockState = (id, state) => {
    setStock(setCycleStockState(id, state))
  }

  const handleAddToShoppingList = (item) => {
    addShoppingItem(t(item.nameKey), null, 0)
    setAddedIds((prev) => new Set(prev).add(item.id))
  }

  const lowStockItems = stock.filter((item) => item.state !== 'Available')

  return (
    <div className="cycle-page">
      <h2>{t('nav.cycle')}</h2>

      <div className="card cycle-forecast">
        <h3>{t('cycle.forecastTitle')}</h3>
        {!forecast.hasData ? (
          <p className="placeholder-text">{t('cycle.forecastNoData')}</p>
        ) : (
          <>
            <p className="cycle-forecast-date">
              {t('cycle.forecastDate', {
                from: formatDateObj(toRangeDate(forecast.predictedDate, -forecast.rangeDays)),
                to: formatDateObj(toRangeDate(forecast.predictedDate, forecast.rangeDays)),
              })}
            </p>
            {forecast.insufficientHistory && (
              <p className="placeholder-text">{t('cycle.forecastInsufficient')}</p>
            )}
            {forecast.isRegular === false && (
              <p className="placeholder-text">{t('cycle.forecastIrregular')}</p>
            )}
          </>
        )}
      </div>

      <div className="card cycle-actions">
        <button type="button" onClick={handleMarkStart}>
          {t('cycle.markStart')}
        </button>
        <button type="button" onClick={handleMarkEnd} disabled={!openRecord}>
          {t('cycle.markEnd')}
        </button>
      </div>

      <div className="card cycle-history">
        <h3>{t('cycle.historyTitle')}</h3>
        {records.length === 0 ? (
          <p className="placeholder-text">{t('cycle.historyEmpty')}</p>
        ) : (
          <ul className="cycle-history-list">
            {[...records].reverse().map((record) => (
              <li key={record.id} className="cycle-history-row">
                <span>{formatDate(record.startDate)}</span>
                <span>—</span>
                <span>{record.endDate ? formatDate(record.endDate) : t('cycle.historyOngoing')}</span>
                <button
                  type="button"
                  className="task-item-action task-item-action--danger"
                  onClick={() => handleDelete(record.id)}
                >
                  {t('planner.actionDelete')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card cycle-stock">
        <h3>{t('cycle.stockTitle')}</h3>
        <p className="placeholder-text">{t('cycle.stockHint')}</p>
        <ul className="cycle-stock-list">
          {stock.map((item) => (
            <li key={item.id} className="cycle-stock-row">
              <span className="cycle-stock-name">{t(item.nameKey)}</span>
              <select value={item.state} onChange={(e) => handleStockState(item.id, e.target.value)}>
                <option value="Available">{t('cycle.stock.state.Available')}</option>
                <option value="RunningLow">{t('cycle.stock.state.RunningLow')}</option>
                <option value="OutOfStock">{t('cycle.stock.state.OutOfStock')}</option>
              </select>
              {item.state !== 'Available' && (
                <button
                  type="button"
                  disabled={addedIds.has(item.id)}
                  onClick={() => handleAddToShoppingList(item)}
                >
                  {addedIds.has(item.id) ? t('cycle.addedToShoppingList') : t('cycle.addToShoppingList')}
                </button>
              )}
            </li>
          ))}
        </ul>
        {lowStockItems.length === 0 && <p className="placeholder-text">{t('cycle.stockAllGood')}</p>}
      </div>

      <div className="card cycle-settings">
        <label className="cycle-settings-row">
          <input
            type="checkbox"
            checked={settings.reduceLoadOnHeavyDays}
            onChange={handleToggleReduceLoad}
          />
          <span>{t('cycle.reduceLoad')}</span>
        </label>
        <p className="placeholder-text">{t('cycle.reduceLoadHint')}</p>
      </div>
    </div>
  )
}

function toRangeDate(apiDate, offsetDays) {
  return addDays(fromApiDate(apiDate), offsetDays)
}
