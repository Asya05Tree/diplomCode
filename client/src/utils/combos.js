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
