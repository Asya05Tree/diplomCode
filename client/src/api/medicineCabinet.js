// API аптечки/здоровʼя. Довідник ліків (2000+ з ДРЛЗ) і взаємодії (DDInter) живуть на бекенді;
// тут — аптечка користувача, пошук для додавання, взаємодії картки та хронічні захворювання.
import { apiGet, apiSend } from './http'

export function getCabinet() {
  return apiGet('/api/medicine-cabinet')
}

// Пошук по довіднику для вікна "додати ліки" (виключає вже додані, максимум ~30).
export function searchMedicines(query) {
  return apiGet(`/api/medicine-cabinet/search?q=${encodeURIComponent(query)}`)
}

export function addMedicine(medicineId) {
  return apiSend('POST', `/api/medicine-cabinet/${medicineId}`)
}

export function setMedicineState(medicineId, state, expiresAt) {
  return apiSend('PUT', `/api/medicine-cabinet/${medicineId}`, { state, expiresAt: expiresAt ?? null })
}

export function removeMedicine(medicineId) {
  return apiSend('DELETE', `/api/medicine-cabinet/${medicineId}`)
}

// Взаємодії картки: пари DDInter, де друга речовина теж є в аптечці користувача.
// Порожньо → UI пише "у базі не знайдено взаємодій" (ніколи "конфліктів немає").
export function getInteractions(medicineId) {
  return apiGet(`/api/medicine-cabinet/${medicineId}/interactions`)
}

export function getConditions() {
  return apiGet('/api/medicine-cabinet/conditions')
}

export function addCondition({ nameUk, affectsFood, tag, relation }) {
  return apiSend('POST', '/api/medicine-cabinet/conditions', { nameUk, affectsFood, tag, relation })
}

export function removeCondition(id) {
  return apiSend('DELETE', `/api/medicine-cabinet/conditions/${id}`)
}

export function medName(m, language) {
  return language === 'en' ? m.nameEn : m.nameUk
}

export function medSubstance(m, language) {
  const v = language === 'en' ? m.substanceEn : m.substanceUk
  return v || ''
}

export function formName(m, language) {
  return language === 'en' ? m.formNameEn : m.formNameUk
}

export function conditionName(c, language) {
  return language === 'en' ? (c.nameEn || c.nameUk) : c.nameUk
}
