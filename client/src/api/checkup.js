// API чекапу здоров'я: заплановані візити до лікарів (створюють події moduleCode="health").
import { apiGet, apiSend } from './http'

export function getVisits() {
  return apiGet('/api/checkup/visits')
}
export function addVisit(data) {
  return apiSend('POST', '/api/checkup/visits', data)
}
export function removeVisit(id) {
  return apiSend('DELETE', `/api/checkup/visits/${id}`)
}
