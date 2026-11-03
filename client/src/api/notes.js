// API нотаток-«квадратиків»: короткий текст з обмеженою довжиною, свій колір.
import { apiGet, apiSend } from './http'

export function getNotes() {
  return apiGet('/api/notes')
}
export function addNote(data) {
  return apiSend('POST', '/api/notes', data)
}
export function updateNote(id, data) {
  return apiSend('PUT', `/api/notes/${id}`, data)
}
export function removeNote(id) {
  return apiSend('DELETE', `/api/notes/${id}`)
}
