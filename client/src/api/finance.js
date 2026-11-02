// API модуля "Фінанси". Рахунок, ліміти та транзакції користувача.
import { apiGet, apiSend } from './http'

export function getFinance() {
  return apiGet('/api/finance')
}

export function setBalance(balance) {
  return apiSend('PUT', '/api/finance/balance', { balance })
}

// Тижнева динаміка витрат за місяць (для вкладки «Статистика»).
export function getStats(year, month) {
  return apiGet(`/api/finance/stats?year=${year}&month=${month}`)
}

export function addTransaction({ amount, type, category, description, occurredAt }) {
  return apiSend('POST', '/api/finance/transactions', {
    amount,
    type,
    category: category ?? null,
    description: description ?? null,
    occurredAt: occurredAt ?? null,
  })
}

// Редагування операції в історії (сума/тип/категорія/опис). «Є зараз» і статистика
// перераховуються автоматично; перенос у сховану категорію робить її активною (на бекенді).
export function updateTransaction(id, { amount, type, category, description }) {
  return apiSend('PUT', `/api/finance/transactions/${id}`, {
    amount,
    type,
    category: category ?? null,
    description: description ?? null,
  })
}

export function removeTransaction(id) {
  return apiSend('DELETE', `/api/finance/transactions/${id}`)
}

// Приховати / повернути категорію (сховані не враховуються у статистиці, писати в них не можна).
export function setCategoryHidden(key, hidden) {
  return apiSend('PUT', `/api/finance/categories/${encodeURIComponent(key)}/hidden`, { hidden })
}
