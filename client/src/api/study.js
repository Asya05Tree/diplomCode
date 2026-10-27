// API модуля "Навчання": предмети, завдання, сітка дзвінків, шкала оцінок.
// Розклад пар зберігається через повторення (api/tasks → recurrence-rules з moduleCode="study").
import { apiGet, apiSend } from './http'

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

export function getBells() {
  return apiGet('/api/study/bells')
}
// Замінює всю сітку: { bells: [{index, startTime, endTime}] }
export function setBells(bells) {
  return apiSend('PUT', '/api/study/bells', { bells })
}

export function getGradeScale() {
  return apiGet('/api/study/grade-scale')
}
// Замінює всю шкалу: { scale: [{minPercent, label}] }
export function setGradeScale(scale) {
  return apiSend('PUT', '/api/study/grade-scale', { scale })
}
