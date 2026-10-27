// API модуля "Їжа". Замінює клієнтську псевдо-БД: довідники (продукти/рецепти) й стан
// (запаси/обрані/готовка) тепер приходять із бекенда одним запитом /overview, а мутації
// йдуть окремими викликами. Сторінка Food.jsx працює лише через цей модуль.
import { apiGet, apiSend } from './http'

// Увесь стан сторінки одним запитом: products, recipes (з health+missingProductIds),
// stock, selected, lastCooked, restrictions.
export function getFoodOverview() {
  return apiGet('/api/food/overview')
}

export function setStockState(productId, state) {
  return apiSend('PUT', `/api/food/stock/${productId}`, { state })
}

export function addStockProduct(productId) {
  return apiSend('POST', `/api/food/stock/${productId}`)
}

export function toggleSelected(recipeId, selected) {
  // selected=true → додати, false → прибрати (сервер розрізняє методом)
  return selected
    ? apiSend('POST', `/api/food/selected/${recipeId}`)
    : apiSend('DELETE', `/api/food/selected/${recipeId}`)
}

export function markCooked(recipeId) {
  return apiSend('POST', `/api/food/recipes/${recipeId}/cooked`)
}

// Двомовні назви — мову обирає компонент (як було в псевдо-БД).
export function productName(product, language) {
  if (!product) return ''
  return language === 'en' ? product.nameEn : product.nameUk
}

export function recipeName(recipe, language) {
  return language === 'en' ? recipe.nameEn : recipe.nameUk
}

export function ingredientAmount(ingredient, language) {
  return language === 'en' ? ingredient.amountEn : ingredient.amountUk
}

// Підпис тега-обмеження для показу в стравах/запасах (бекенд віддає displayName у restrictions).
export function tagLabelFrom(restrictions, tagKey) {
  if (!tagKey) return tagKey
  const r = restrictions.find((x) => x.tagKey === tagKey)
  return r ? r.displayName || tagKey : tagKey
}
