import { API_BASE_URL, throwApiError } from './client'
import { toApiDate } from '../utils/date'

async function apiGet(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) await throwApiError(response)
  return response.json()
}

async function apiSend(method, path, token, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) await throwApiError(response)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

// ---- День / Період -----------------------------------------------------------------------

export function getDayTasks(token, date) {
  return apiGet(`/api/tasks/day?date=${toApiDate(date)}`, token)
}

export function getPeriodTasks(token, from, to) {
  return apiGet(`/api/tasks/period?from=${toApiDate(from)}&to=${toApiDate(to)}`, token)
}

export function getFreeDays(token, from, to, minHours) {
  return apiGet(`/api/tasks/free-days?from=${toApiDate(from)}&to=${toApiDate(to)}&minHours=${minHours}`, token)
}

// ---- Нерозподілені / нагадувальник --------------------------------------------------------

export function getUnassigned(token) {
  return apiGet('/api/tasks/unassigned', token)
}

export function getUnassignedCount(token) {
  return apiGet('/api/tasks/unassigned/count', token)
}

export function getReminder(token) {
  return apiGet('/api/tasks/reminder', token)
}

export function resolveTask(token, id, action) {
  return apiSend('POST', `/api/tasks/${id}/resolve`, token, { action })
}

// ---- CRUD одноразової задачі ---------------------------------------------------------------

export function createTask(token, { title, description, startDateTime, durationMinutes, deadline }) {
  return apiSend('POST', '/api/tasks', token, { title, description, startDateTime, durationMinutes, deadline })
}

export function updateTask(token, id, { title, description, startDateTime, durationMinutes, deadline }) {
  return apiSend('PUT', `/api/tasks/${id}`, token, { title, description, startDateTime, durationMinutes, deadline })
}

export function deleteTask(token, id) {
  return apiSend('DELETE', `/api/tasks/${id}`, token)
}

// ---- Правила повторення --------------------------------------------------------------------

export function getRecurrenceRules(token) {
  return apiGet('/api/recurrence-rules', token)
}

export function createRecurrenceRule(token, payload) {
  return apiSend('POST', '/api/recurrence-rules', token, payload)
}

export function updateRecurrenceRule(token, id, payload) {
  return apiSend('PUT', `/api/recurrence-rules/${id}`, token, payload)
}

export function deleteRecurrenceRule(token, id) {
  return apiSend('DELETE', `/api/recurrence-rules/${id}`, token)
}

export function previewRecurrenceRule(token, id, from, to) {
  return apiGet(`/api/recurrence-rules/${id}/preview?from=${toApiDate(from)}&to=${toApiDate(to)}`, token)
}

export function addException(token, ruleId, payload) {
  return apiSend('POST', `/api/recurrence-rules/${ruleId}/exceptions`, token, payload)
}

export function deleteException(token, ruleId, exceptionId) {
  return apiSend('DELETE', `/api/recurrence-rules/${ruleId}/exceptions/${exceptionId}`, token)
}
