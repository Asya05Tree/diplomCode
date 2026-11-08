// "Важливі борги" головного календаря: прострочені (дедлайн минув, не відмічено виконаним) завдання
// навчання та задачі планування процесу роботи. Збираємо на клієнті з доменних API — окремого
// бекенд-ендпоінта не заводимо (просто). Виклики захищені: якщо модуль недоступний — порожньо.
import { getAssignments } from '../api/study'
import { getProcessTasks } from '../api/work'
import { todayApiDate } from './date'

// studentType — 'pupil' | 'student' | інше (навчання тягнемо лише для школяра/студента).
// isWorking — чи працює користувач (робочі борги тягнемо лише для працюючих). Той, хто не
// навчається й не працює, боргів не має взагалі.
export async function loadDebts(studentType, isWorking) {
  const today = todayApiDate()
  const out = []

  if (studentType === 'pupil' || studentType === 'student') {
    const assignments = await getAssignments().catch(() => [])
    for (const a of assignments || []) {
      if (!a.isDone && a.resolvedDeadline && a.resolvedDeadline < today) {
        out.push({
          id: `study-${a.id}`,
          kind: 'study',
          title: a.description,
          subtitle: a.subjectName || '',
          due: a.resolvedDeadline,
        })
      }
    }
  }

  const processTasks = isWorking ? await getProcessTasks().catch(() => []) : []
  for (const p of processTasks || []) {
    if (p.status !== 'done' && p.dueDate && p.dueDate < today) {
      out.push({
        id: `work-${p.id}`,
        kind: 'work',
        title: p.title,
        subtitle: p.note || '',
        due: p.dueDate,
      })
    }
  }

  // Найдавніший прострочений — угорі
  out.sort((x, y) => (x.due < y.due ? -1 : x.due > y.due ? 1 : 0))
  return out
}
