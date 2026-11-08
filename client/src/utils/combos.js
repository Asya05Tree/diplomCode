// Спільна логіка підбору комбінацій під бюджет — використовується і демо на Landing,
// і вкладкою "Можливі варіанти покупки" у формі задачі "Піти в магазин".

export function clamp(value, min, max) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

// Усі набори позицій (будь-якого розміру — 1, 2, 3 і більше), сума яких вкладається
// в бюджет і до яких не можна додати ще хоч одну позицію без перевищення бюджету.
// Показуємо тільки такі "максимальні" набори: якщо набір можна доповнити — його
// витісняє більший набір, що вже охоплює той самий варіант.
export function findMaximalCombos(items, budget) {
  // Перебір масок — O(2^n), прийнятно для невеликих демо-наборів і для списку покупок
  // користувача в розумних межах; більші списки обрізаємо, щоб не підвісити вкладку.
  const capped = items.slice(0, 20)
  const n = capped.length
  const results = []
  for (let mask = 1; mask < 1 << n; mask++) {
    let total = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) total += capped[i].price
    }
    if (total > budget) continue

    let canAddMore = false
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i)) && total + capped[i].price <= budget) {
        canAddMore = true
        break
      }
    }
    if (canAddMore) continue

    results.push({ items: capped.filter((_, i) => mask & (1 << i)), total })
  }
  results.sort((a, b) => b.total - a.total || b.items.length - a.items.length)
  return results
}

// Усі комбінації рівно з k позицій (для автопідбору «за кількістю», коли цін ще нема) —
// показуємо варіанти набору «А + Б + В, або А + Б + Г…», а не перші k зі списку. Кількість
// варіантів обрізаємо (C(n,k) росте швидко), щоб не підвісити вкладку на великому списку.
export function findCountCombos(items, k, maxResults = 40) {
  const capped = items.slice(0, 20)
  const n = capped.length
  const size = Math.min(Math.max(0, Math.floor(k)), n)
  if (size <= 0) return []
  const results = []
  const combo = []
  const rec = (start) => {
    if (results.length >= maxResults) return
    if (combo.length === size) {
      results.push({ items: combo.slice() })
      return
    }
    for (let i = start; i < n && results.length < maxResults; i++) {
      combo.push(capped[i])
      rec(i + 1)
      combo.pop()
    }
  }
  rec(0)
  return results
}
