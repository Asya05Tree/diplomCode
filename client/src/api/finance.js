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

export function removeTransaction(id) {
  return apiSend('DELETE', `/api/finance/transactions/${id}`)
}
