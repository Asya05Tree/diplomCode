// §10 / §11 — ReplaceBells тепер валідує сітку НА СЕРВЕРІ: до 12 дзвінків, індекс 1..12 без повторів,
// endTime > startTime. Порожній список = очищення (легітимно).
// FIXED (залишок 09-study/06): StudyService.ReplaceBellsAsync відхиляє too_many_bells / invalid_bell_index /
// invalid_bell_time / duplicate_bell_index (400), нічого не зберігаючи.
import { provision, api } from '../_lib/provision.mjs'

const tag = Math.random().toString(36).slice(2, 7)
const U = await provision({ email: `adv.t09.bells.${tag}@gmail.com`, gender: 'female', studentType: 'pupil', isWorking: false })

// 1) 53 кривих рядки: end<start, дубль індексу, від'ємний індекс, 50 зайвих
const weird = [
  { index: 1, startTime: '14:00:00', endTime: '08:00:00' }, // end before start
  { index: 1, startTime: '09:00:00', endTime: '10:00:00' }, // duplicate index
  { index: -5, startTime: '10:00:00', endTime: '11:00:00' }, // negative index
]
for (let i = 0; i < 50; i++) weird.push({ index: 100 + i, startTime: '07:00:00', endTime: '07:30:00' })

const put = await api('PUT', '/api/study/bells', { token: U.token, body: { bells: weird } })
const after = (await api('GET', '/api/study/bells', { token: U.token })).json || []
console.log('PUT 53 bells (end<start, dup, neg, 50 rows) ->', put.status, put.json?.error ?? '', '; stored count=', after.length)

// 2) Валідна маленька сітка — має пройти (не над-блокуємо)
const good = [
  { index: 1, startTime: '08:30:00', endTime: '09:15:00' },
  { index: 2, startTime: '09:25:00', endTime: '10:10:00' },
]
const okPut = await api('PUT', '/api/study/bells', { token: U.token, body: { bells: good } })
const okAfter = (await api('GET', '/api/study/bells', { token: U.token })).json || []
console.log('PUT 2 valid bells ->', okPut.status, '; stored count=', okAfter.length)

const refuted = put.status === 400 && after.length === 0 && okPut.status === 200 && okAfter.length === 2
console.log('\n' + (refuted
  ? 'REFUTED — крива сітка відхилена (400), нічого не збережено; валідна сітка з 2 дзвінків проходить. ' +
    'Межі кількості, унікальність індексу та endTime>startTime перевіряються на сервері.'
  : 'CONFIRMED/partial — put=' + put.status + ' stored=' + after.length + ' okPut=' + okPut.status + ' okStored=' + okAfter.length))
