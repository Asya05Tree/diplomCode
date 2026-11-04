// Білінг платної фічі "швидке додавання": стан/ліміт, списання використання, оплата.
// Токен додається автоматично (http.js бере його з localStorage).
import { apiGet, apiSend } from './http'

// { used, limit, remaining, unlocked, price, currency }
export function getQuickAddStatus() {
  return apiGet('/api/quick-add/status')
}

// Витратити одне безкоштовне використання. При вичерпанні ліміту сервер віддає 402 →
// http.js кидає Error('limit_reached'), який викликач ловить і показує paywall.
export function consumeQuickAdd() {
  return apiSend('POST', '/api/quick-add/consume')
}

// Старт оплати. Повертає { alreadyUnlocked } | { mock:true, orderReference, amount, currency }
// | { mock:false, orderReference, action, fields } (поля форми для автосабміту в WayForPay).
export function checkoutQuickAdd() {
  return apiSend('POST', '/api/billing/checkout')
}

// Підтвердити оплату після повернення з платіжки. Повертає { paid, status }.
export function confirmPayment(orderReference) {
  return apiSend('POST', '/api/billing/confirm', { orderReference })
}
