// Шість комбінацій «навчання + робота» для реєстрації та налаштувань. Кожна зводиться до пари
// (studentType, isWorking), яку очікує бекенд. Комбінації «школяр + студент» немає — одночасно
// і школярем, і студентом бути не можна. Ключ використовується лише як значення селекта і для
// i18n-підпису (occupation.<key>); у стані форми зберігаються studentType + isWorking як і раніше.
export const OCCUPATIONS = [
  // [ключ, studentType, isWorking]
  ['none', 'none', false],
  ['student', 'student', false],
  ['pupil', 'pupil', false],
  ['working', 'none', true],
  ['student_working', 'student', true],
  ['pupil_working', 'pupil', true],
]

// (studentType, isWorking) → ключ комбінації (для показу поточного вибору).
export function occupationKey(studentType, isWorking) {
  const found = OCCUPATIONS.find(([, st, w]) => st === studentType && w === isWorking)
  return found ? found[0] : 'none'
}

// Ключ комбінації → { studentType, isWorking } (для оновлення стану з вибору в селекті).
export function occupationValue(key) {
  const found = OCCUPATIONS.find(([k]) => k === key)
  return found
    ? { studentType: found[1], isWorking: found[2] }
    : { studentType: 'none', isWorking: false }
}
