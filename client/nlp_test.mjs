import { parseInput } from './src/utils/nlp/index.js'

const NOW = new Date(2026, 10, 3) // 2026-11-03, вівторок

const cases = [
  'купити молоко завтра о 5',
  'подивитися фільм 4 листопада о 16:00',
  'зустріч 4',
  'buy milk tomorrow at 4pm, then read book on friday',
  '4.5 години робота',
  '15.11 здати звіт',
  'подзвонити мамі 25 числа',
  'зробити щось о 9 і ще купити хліб на 7',
  'asdf',
  'о 16:00',
  'приготувати вечерю на 2 години завтра',
  'next friday watch movie',
  'зателефонувати в пʼятницю о 10 ранку',
]

for (const c of cases) {
  const r = parseInput(c, NOW)
  console.log('IN :', c)
  console.log('LANG:', r.language)
  for (const t of r.tasks) {
    console.log('  TASK title=%o date=%o time=%o dur=%o mod=%o amb=%o',
      t.title, t.date, t.time, t.durationMinutes, t.module, t.ambiguous)
  }
  if (r.notRecognized.length) console.log('  NOT_RECOGNIZED:', r.notRecognized)
  console.log('')
}
