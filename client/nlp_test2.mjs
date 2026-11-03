import uk from './src/utils/nlp/dict.uk.js'
import en from './src/utils/nlp/dict.en.js'
import { parseInput } from './src/utils/nlp/parser.js'

const now = new Date(2026, 10, 4, 9, 0, 0) // 2026-11-04 (ср); "завтра"=05.11, "п'ятого"=05.11
const DICTS = [uk, en]
const run = (t) => parseInput(t, DICTS, now)

const cases = [
  "хочу купити морозиво завтра потім піти на прогулянку, а п'ятого піти до стоматолога. and i want to go play",
  "короче пара математики викладач віктор федорович посилання немає пара завтра друга",
  "купити молоко завтра о 17, потім подивитися фільм",
  "подзвонити мамі о 19",
  "buy milk on the fifth",
  "записатися до лікаря на 15 число",
  "оплатити рахунок завтра",
  "4.5 години робити курсову",
]

for (const c of cases) {
  const r = run(c)
  console.log('\n=== ' + c)
  console.log('  lang:', r.language, '| notRecognized:', JSON.stringify(r.notRecognized))
  for (const task of r.tasks) {
    console.log('  -', JSON.stringify({
      title: task.title, date: task.date, time: task.time,
      dur: task.durationMinutes, module: task.module,
      inherited: task.inheritedDate || false,
      study: task.study,
      amb: task.ambiguous.map((a) => a.raw),
    }))
  }
}
