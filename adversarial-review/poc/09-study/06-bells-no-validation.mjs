// §10 / §11 HIGH — ReplaceBells does zero validation: ignores min/max (UI bounds pupil 1-7 /
// student 1-6), allows endTime<startTime, duplicate/negative indices, and 0 bells (wipes grid).
// Code: StudyController.ReplaceBells:130 (just passes through), StudyService.ReplaceBellsAsync:250.
import { provision, api } from '../_lib/provision.mjs'

const U = await provision({ email: 'adv.t09.bells@gmail.com', gender: 'female', studentType: 'pupil', isWorking: false })

// 1) end < start, duplicate index, negative index, 50 rows (> UI max 7)
const weird = [
  { index: 1, startTime: '14:00:00', endTime: '08:00:00' }, // end before start
  { index: 1, startTime: '09:00:00', endTime: '10:00:00' }, // duplicate index
  { index: -5, startTime: '10:00:00', endTime: '11:00:00' }, // negative index
]
for (let i = 0; i < 50; i++) weird.push({ index: 100 + i, startTime: '07:00:00', endTime: '07:30:00' })

const put = await api('PUT', '/api/study/bells', { token: U.token, body: { bells: weird } })
const got = (await api('GET', '/api/study/bells', { token: U.token })).json || []
console.log('PUT 53 bells (end<start, dup idx, neg idx, 50 rows) ->', put.status, 'stored count=', got.length)
console.log('  has end<start row:', got.some((b) => b.endTime < b.startTime))
console.log('  has negative index:', got.some((b) => b.index < 0))
console.log('  distinct indices < rows (duplicates):', new Set(got.map((b) => b.index)).size < got.length)

// 2) wipe the grid entirely
const wipe = await api('PUT', '/api/study/bells', { token: U.token, body: { bells: [] } })
const after = (await api('GET', '/api/study/bells', { token: U.token })).json || []
console.log('\nPUT [] (wipe) ->', wipe.status, 'stored count=', after.length)

const confirmed = put.status === 200 && got.length === 53 &&
  got.some((b) => b.endTime < b.startTime) && got.some((b) => b.index < 0) &&
  wipe.status === 200 && after.length === 0
console.log('\n' + (confirmed
  ? 'CONFIRMED — bells accept end<start, negative/duplicate indices, 50 rows (UI max 7) and an empty ' +
    'wipe, all 200. Expected: validate count bounds, index uniqueness, endTime>startTime. Observed: none.'
  : 'REFUTED — put=' + put.status + ' count=' + got.length + ' wipe=' + wipe.status))
