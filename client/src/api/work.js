// API модуля "Робота": профіль/оплата, типи змін, графік (створює правила moduleCode="work"),
// календар змін, контакти, відсутності, зустрічі (створюють задачі moduleCode="work") та зобов'язання.
import { apiGet, apiSend } from './http'
import { toApiDate } from '../utils/date'

// ---- Профіль роботи / оплата ----
export function getWorkSettings() {
  return apiGet('/api/work/settings')
}
export function setWorkSettings(data) {
  return apiSend('PUT', '/api/work/settings', data)
}

// ---- Типи змін ----
export function getShiftTypes() {
  return apiGet('/api/work/shift-types')
}
export function addShiftType(data) {
  return apiSend('POST', '/api/work/shift-types', data)
}
export function updateShiftType(id, data) {
  return apiSend('PUT', `/api/work/shift-types/${id}`, data)
}
export function removeShiftType(id) {
  return apiSend('DELETE', `/api/work/shift-types/${id}`)
}

// ---- Записи графіка ----
export function getScheduleEntries() {
  return apiGet('/api/work/schedule')
}
export function addScheduleEntry(data) {
  return apiSend('POST', '/api/work/schedule', data)
}
export function updateScheduleEntry(id, data) {
  return apiSend('PUT', `/api/work/schedule/${id}`, data)
}
export function removeScheduleEntry(id) {
  return apiSend('DELETE', `/api/work/schedule/${id}`)
}

// ---- Календар змін + наступна зміна ----
export function getScheduleCalendar(from, to) {
  return apiGet(`/api/work/schedule/calendar?from=${toApiDate(from)}&to=${toApiDate(to)}`)
}
export function getNextShift() {
  return apiGet('/api/work/schedule/next')
}

// ---- Контакти ----
export function getContacts() {
  return apiGet('/api/work/contacts')
}
export function addContact(data) {
  return apiSend('POST', '/api/work/contacts', data)
}
export function updateContact(id, data) {
  return apiSend('PUT', `/api/work/contacts/${id}`, data)
}
export function removeContact(id) {
  return apiSend('DELETE', `/api/work/contacts/${id}`)
}

// ---- Відсутності (відпустки / лікарняні) ----
export function getLeaves() {
  return apiGet('/api/work/leaves')
}
export function addLeave(data) {
  return apiSend('POST', '/api/work/leaves', data)
}
export function updateLeave(id, data) {
  return apiSend('PUT', `/api/work/leaves/${id}`, data)
}
export function removeLeave(id) {
  return apiSend('DELETE', `/api/work/leaves/${id}`)
}

// ---- Зустрічі ----
export function getMeetings() {
  return apiGet('/api/work/meetings')
}
export function addMeeting(data) {
  return apiSend('POST', '/api/work/meetings', data)
}
export function updateMeeting(id, data) {
  return apiSend('PUT', `/api/work/meetings/${id}`, data)
}
export function removeMeeting(id) {
  return apiSend('DELETE', `/api/work/meetings/${id}`)
}

// ---- Зобов'язання / планування ----
export function getObligations() {
  return apiGet('/api/work/obligations')
}
export function addObligation(data) {
  return apiSend('POST', '/api/work/obligations', data)
}
export function updateObligation(id, data) {
  return apiSend('PUT', `/api/work/obligations/${id}`, data)
}
export function removeObligation(id) {
  return apiSend('DELETE', `/api/work/obligations/${id}`)
}
