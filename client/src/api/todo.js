// API простої дошки задач (три колонки todo|doing|done).
import { apiGet, apiSend } from './http'

export function getTodos() {
  return apiGet('/api/todo')
}

export function addTodo(text) {
  return apiSend('POST', '/api/todo', { text })
}

export function moveTodo(id, status, orderIndex) {
  return apiSend('PUT', `/api/todo/${id}/move`, { status, orderIndex })
}

export function removeTodo(id) {
  return apiSend('DELETE', `/api/todo/${id}`)
}
