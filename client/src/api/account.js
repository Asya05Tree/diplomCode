// API керування акаунтом: експорт усіх даних у JSON (завантаження на пристрій), видалення всіх
// даних (акаунт лишається) та повне видалення акаунта. Видалення потребують пароля.
import { API_BASE_URL } from './client'
import { apiSend, getToken } from './http'

// Експорт: тягнемо файл JSON і зберігаємо на пристрій через тимчасове посилання
export async function exportData() {
  const res = await fetch(`${API_BASE_URL}/api/account/export`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error('export_failed')
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const match = cd.match(/filename="?([^"]+)"?/)
  const filename = match ? match[1] : 'vsetut-export.json'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function wipeData(password) {
  return apiSend('POST', '/api/account/wipe', { password })
}

export function deleteAccount(password) {
  return apiSend('POST', '/api/account/delete', { password })
}
