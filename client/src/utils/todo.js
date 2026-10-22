// Дошка задач "To-Do" (planner-spec.md — поки без бекенду), тому дані живуть у
// localStorage за тим самим принципом, що й цикл (utils/cycle.js), фінанси та
// список покупок. Три стани-"листки": Зробити → В процесі → Зроблено.
const KEY = 'todo:items'

export const TODO_STATUSES = ['todo', 'doing', 'done']

function newId() {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

export function getTodos() {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function addTodo(text) {
  const trimmed = text.trim()
  if (!trimmed) return getTodos()
  const items = [...getTodos(), { id: newId(), text: trimmed, status: 'todo' }]
  save(items)
  return items
}

// Переміщення картки між "листками" на крок вліво/вправо (dir = -1 | 1),
// обмежене межами списку статусів.
export function moveTodo(id, dir) {
  const items = getTodos().map((item) => {
    if (item.id !== id) return item
    const idx = TODO_STATUSES.indexOf(item.status)
    const next = Math.min(TODO_STATUSES.length - 1, Math.max(0, idx + dir))
    return { ...item, status: TODO_STATUSES[next] }
  })
  save(items)
  return items
}

export function deleteTodo(id) {
  const items = getTodos().filter((item) => item.id !== id)
  save(items)
  return items
}
