export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080'

export async function getHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`)
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`)
  }
  return response.json()
}

// При помилці кидає Error, чий message — код помилки з бекенду (invalid_email, invalid_nickname,
// email_taken, invalid_code...), щоб форма могла показати конкретний переклад, а не загальну фразу.
export async function throwApiError(response) {
  const body = await response.json().catch(() => null)
  const code = body?.error ?? `request_failed_${response.status}`
  // Досягнуто ліміту кількості записів (будь-яка вкладка) — одразу кажемо користувачу, що більше
  // додати не можна, незалежно від того, чи конкретна сторінка показує помилку сама.
  if (code === 'record_limit_reached') notifyLimitReached(body?.limit)
  throw new Error(code)
}

function notifyLimitReached(limit) {
  const lang = localStorage.getItem('settings:language') === 'en' ? 'en' : 'uk'
  const msg = lang === 'en'
    ? `Record limit reached${limit ? ` (max ${limit})` : ''}. Delete some entries before adding new ones.`
    : `Досягнуто ліміту кількості записів${limit ? ` (максимум ${limit})` : ''}. Видаліть зайве, щоб додати нове.`
  if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(msg)
}

export async function sendCode(email, nickname) {
  const response = await fetch(`${API_BASE_URL}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, nickname }),
  })
  if (!response.ok) await throwApiError(response)
}

export async function register({ nickname, gender, email, code, password, studentType, isWorking }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, gender, email, code, password, studentType, isWorking }),
  })
  if (!response.ok) await throwApiError(response)
  return response.json()
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    throw new Error(`login failed: ${response.status}`)
  }
  return response.json()
}

export async function getMe(token) {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`me failed: ${response.status}`)
  }
  return response.json()
}
