// API модуля "Список покупок" (повна специфікація spisok-pokupok.md).
import { apiGet, apiSend } from './http'

// { items, suggestions, priceCoverage } — все для сторінки одним запитом.
export function getShoppingList() {
  return apiGet('/api/shopping-list')
}

// Додати позицію вручну: section + (text | productId | medicineId), опційно category.
export function addShoppingItem({ section, category, text, productId, medicineId }) {
  return apiSend('POST', '/api/shopping-list', {
    section: section ?? 'Groceries',
    category: category ?? null,
    text: text ?? null,
    productId: productId ?? null,
    medicineId: medicineId ?? null,
  })
}

export function removeShoppingItem(id) {
  return apiSend('DELETE', `/api/shopping-list/${id}`)
}

export function setItemCategory(id, category) {
  return apiSend('PUT', `/api/shopping-list/${id}/category`, { category })
}

// Відмітка покупки: один жест — поповнює запаси + ціну + витрату (price необовʼязкова).
export function checkItem(id, price) {
  return apiSend('POST', `/api/shopping-list/${id}/check`, { price: price ?? null })
}

// Альтернатива поцінового вводу: сума чека, яку система розкладає по позиціях без цін.
export function submitReceiptTotal(total) {
  return apiSend('POST', '/api/shopping-list/receipt-total', { total })
}

// Створити задачу-нагадування "похід у магазин" (повертає { taskId }).
export function planTrip() {
  return apiSend('POST', '/api/shopping-list/plan-trip')
}
