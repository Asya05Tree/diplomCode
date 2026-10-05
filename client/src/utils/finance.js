const STORAGE_KEY = 'finance:balance'

// planner-spec.md §3.6 — FinanceAccount: єдиний баланс, користувач редагує його вручну
// в розділі "Фінанси", а інші модулі (список покупок тощо) лише читають це значення.
export function getFinanceBalance() {
  const raw = localStorage.getItem(STORAGE_KEY)
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

export function setFinanceBalance(value) {
  localStorage.setItem(STORAGE_KEY, String(Math.max(0, Number(value) || 0)))
}
