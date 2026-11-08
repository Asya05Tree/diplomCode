// API щеплень (вкладка "Здоров'я"): системний довідник доз + відмітки користувача.
// Статуси (до віку / строк минув / виконано / наступна) рахуються на клієнті з віку профілю.
import { apiGet, apiSend } from './http'

export function getVaccinations() {
  return apiGet('/api/vaccination')
}
export function markVaccination(data) {
  return apiSend('POST', '/api/vaccination/records', data)
}
export function updateVaccination(id, data) {
  return apiSend('PUT', `/api/vaccination/records/${id}`, data)
}
export function removeVaccination(id) {
  return apiSend('DELETE', `/api/vaccination/records/${id}`)
}
