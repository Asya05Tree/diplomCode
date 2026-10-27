// Спільний шар HTTP-викликів до бекенда для всіх модулів (їжа, здоровʼя, покупки тощо).
// Токен зберігається під ключем 'authToken' (див. App.jsx) і додається в заголовок Bearer —
// той самий патерн, що в api/tasks.js, лише винесений в одне місце, щоб не дублювати в кожному модулі.
import { API_BASE_URL, throwApiError } from './client'

const AUTH_TOKEN_KEY = 'authToken'

export function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export async function apiGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!response.ok) await throwApiError(response)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export async function apiSend(method, path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) await throwApiError(response)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}
