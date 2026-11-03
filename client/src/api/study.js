// API модуля "Навчання": налаштування, предмети, завдання, сітка дзвінків, розклад/консультації,
// великі роботи (диплом/курсова/практика). Розклад і консультації на бекенді також створюють
// правило повторення (moduleCode="study"), тому з'являються і в спільному календарі.
import { apiGet, apiSend } from './http'

// ---- Налаштування навчання ----
export function getStudySettings() {
  return apiGet('/api/study/settings')
}
export function setStudySettings(data) {
  return apiSend('PUT', '/api/study/settings', data)
}

// ---- Предмети ----
export function getSubjects() {
  return apiGet('/api/study/subjects')
}
export function addSubject(data) {
  return apiSend('POST', '/api/study/subjects', data)
}
export function updateSubject(id, data) {
  return apiSend('PUT', `/api/study/subjects/${id}`, data)
}
export function removeSubject(id) {
  return apiSend('DELETE', `/api/study/subjects/${id}`)
}

// ---- Завдання ----
export function getAssignments() {
  return apiGet('/api/study/assignments')
}
export function addAssignment(data) {
  return apiSend('POST', '/api/study/assignments', data)
}
export function updateAssignment(id, data) {
  return apiSend('PUT', `/api/study/assignments/${id}`, data)
}
export function removeAssignment(id) {
  return apiSend('DELETE', `/api/study/assignments/${id}`)
}

// ---- Дзвінки (замінює всю сітку) ----
export function getBells() {
  return apiGet('/api/study/bells')
}
export function setBells(bells) {
  return apiSend('PUT', '/api/study/bells', { bells })
}

// ---- Розклад / консультації / факультативи ----
// kind: 'lesson' | 'consultation' | 'elective' (без kind — усі)
export function getScheduleEntries(kind) {
  return apiGet(`/api/study/schedule${kind ? `?kind=${kind}` : ''}`)
}
export function addScheduleEntry(data) {
  return apiSend('POST', '/api/study/schedule', data)
}
export function updateScheduleEntry(id, data) {
  return apiSend('PUT', `/api/study/schedule/${id}`, data)
}
export function removeScheduleEntry(id) {
  return apiSend('DELETE', `/api/study/schedule/${id}`)
}

// ---- Великі роботи (диплом / курсова / практика) ----
export function getProjects(kind) {
  return apiGet(`/api/study/projects${kind ? `?kind=${kind}` : ''}`)
}
export function addProject(data) {
  return apiSend('POST', '/api/study/projects', data)
}
export function updateProject(id, data) {
  return apiSend('PUT', `/api/study/projects/${id}`, data)
}
export function removeProject(id) {
  return apiSend('DELETE', `/api/study/projects/${id}`)
}
export function addProjectStep(projectId, data) {
  return apiSend('POST', `/api/study/projects/${projectId}/steps`, data)
}
export function updateProjectStep(stepId, data) {
  return apiSend('PUT', `/api/study/steps/${stepId}`, data)
}
export function removeProjectStep(stepId) {
  return apiSend('DELETE', `/api/study/steps/${stepId}`)
}
