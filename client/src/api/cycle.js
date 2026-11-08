// API модуля "Цикл". Записи, налаштування та прогноз (рахується на бекенді).
import { apiGet, apiSend } from './http'

export function getCycle() {
  return apiGet('/api/cycle')
}

export function removeCycleRecord(id) {
  return apiSend('DELETE', `/api/cycle/records/${id}`)
}

// Дата-орієнтовані позначення (кліком на календарі) — дані єдині для всіх календарів.
export function markCycleStart(date) {
  return apiSend('POST', '/api/cycle/start', { date })
}

export function markCycleEnd(date) {
  return apiSend('POST', '/api/cycle/end', { date })
}

export function clearCycleDay(date) {
  return apiSend('POST', '/api/cycle/clear', { date })
}

export function setCycleSettings({ reduceLoadOnHeavyDays, hygieneProduct }) {
  return apiSend('PUT', '/api/cycle/settings', { reduceLoadOnHeavyDays, hygieneProduct: hygieneProduct ?? null })
}
