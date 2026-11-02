// API списку "що подивитися / що прочитати" (відео / книги).
// Статуси рухаються лише вперед: planned → in_progress (через schedule) → done.
import { apiGet, apiSend } from './http'

export function getMedia() {
  return apiGet('/api/media')
}

export function addMedia({ kind, title, author }) {
  return apiSend('POST', '/api/media', { kind, title, author: author || null })
}

// planned → in_progress: створює подію в календарі на вказану дату/час.
export function scheduleMedia(id, { startDateTime, durationMinutes }) {
  return apiSend('POST', `/api/media/${id}/schedule`, { startDateTime, durationMinutes: durationMinutes ?? null })
}

// Перехід статусу вперед (на практиці — у "done" з рейтингом/відгуком).
export function setMediaStatus(id, { status, ratingStars, review }) {
  return apiSend('PUT', `/api/media/${id}/status`, {
    status,
    ratingStars: ratingStars ?? null,
    review: review || null,
  })
}

export function updateMedia(id, { title, author, ratingStars, review }) {
  return apiSend('PUT', `/api/media/${id}`, {
    title,
    author: author || null,
    ratingStars: ratingStars ?? null,
    review: review || null,
  })
}

export function deleteMedia(id) {
  return apiSend('DELETE', `/api/media/${id}`)
}
