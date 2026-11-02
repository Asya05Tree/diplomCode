// API списку "що подивитися / що прочитати" (відео / книги).
// Статуси рухаються лише вперед: planned → in_progress (через schedule) → done.
// Класифікація: genre (відео й книги) + mediaType (вид, лише відео) — ключі з watchlistTaxonomy.js.
import { apiGet, apiSend } from './http'

export function getMedia() {
  return apiGet('/api/media')
}

export function addMedia({ kind, title, author, genre, mediaType }) {
  return apiSend('POST', '/api/media', {
    kind,
    title,
    author: author || null,
    genre: genre || null,
    mediaType: mediaType || null,
  })
}

// planned → in_progress: створює подію в календарі на вказану дату/час; може доввести вид/жанр.
export function scheduleMedia(id, { startDateTime, durationMinutes, genre, mediaType }) {
  return apiSend('POST', `/api/media/${id}/schedule`, {
    startDateTime,
    durationMinutes: durationMinutes ?? null,
    genre: genre || null,
    mediaType: mediaType || null,
  })
}

// Перехід статусу вперед (на практиці — у "done" з рейтингом/відгуком).
export function setMediaStatus(id, { status, ratingStars, review }) {
  return apiSend('PUT', `/api/media/${id}/status`, {
    status,
    ratingStars: ratingStars ?? null,
    review: review || null,
  })
}

// Редагування. Клієнт завжди передає поточні genre/mediaType, щоб не затерти класифікацію.
export function updateMedia(id, { title, author, ratingStars, review, genre, mediaType }) {
  return apiSend('PUT', `/api/media/${id}`, {
    title,
    author: author || null,
    ratingStars: ratingStars ?? null,
    review: review || null,
    genre: genre || null,
    mediaType: mediaType || null,
  })
}

export function deleteMedia(id) {
  return apiSend('DELETE', `/api/media/${id}`)
}
