// API модуля "Цикл". Записи, налаштування та прогноз (рахується на бекенді).
import { apiGet, apiSend } from './http'

export function getCycle() {
  return apiGet('/api/cycle')
}

export function addCycleRecord(startDate) {
  return apiSend('POST', '/api/cycle/records', { startDate })
}

export function endCycleRecord(id, endDate) {
  return apiSend('POST', `/api/cycle/records/${id}/end`, { endDate })
}

export function removeCycleRecord(id) {
  return apiSend('DELETE', `/api/cycle/records/${id}`)
}

export function setCycleSettings(reduceLoadOnHeavyDays) {
  return apiSend('PUT', '/api/cycle/settings', { reduceLoadOnHeavyDays })
}
