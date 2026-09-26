const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080'

export async function getHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`)
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`)
  }
  return response.json()
}

// При помилці кидає Error, чий message — код помилки з бекенду (invalid_email, invalid_nickname,
// email_taken, invalid_code...), щоб форма могла показати конкретний переклад, а не загальну фразу.
async function throwApiError(response) {
  const body = await response.json().catch(() => null)
  throw new Error(body?.error ?? `request_failed_${response.status}`)
}

export async function sendCode(email, nickname) {
  const response = await fetch(`${API_BASE_URL}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, nickname }),
  })
  if (!response.ok) await throwApiError(response)
}

export async function register({ nickname, gender, email, code, password }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, gender, email, code, password }),
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
