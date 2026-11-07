// §9 KEY BUG — orphaned return-reminder after calendar cascade delete.
// Repro: library book with deadline -> schedule (creates reading event TaskId) ->
// delete the READING event via DELETE /api/tasks/{TaskId} (cascadeSource=true) ->
// MediaItem is cascade-removed, but its ReturnTaskId (sourceModule=media_return)
// is NOT cleaned up -> the "Повернути книгу" reminder orphans in the calendar.
import { provision, api } from '../_lib/provision.mjs'
import { db } from './_db.mjs'

const U = await provision({ email: 'adv.t04.orphan@gmail.com' })
const tok = U.token
const uid = U.userId

const made = await api('POST', '/api/media', {
  token: tok,
  body: { kind: 'book', title: 'Orphan-Repro-Book', author: 'A', isLibrary: true, returnDeadline: '2030-06-01' },
})
const mediaId = made.json.id
let [[returnTaskId]] = db(`SELECT ReturnTaskId FROM MediaItems WHERE Id=${mediaId};`)
console.log(`Created mediaId=${mediaId}, return reminder taskId=${returnTaskId}`)

const sch = await api('POST', `/api/media/${mediaId}/schedule`, { token: tok, body: { startDateTime: '2030-05-20T18:00:00', durationMinutes: 90 } })
const readTaskId = sch.json.taskId
console.log(`Scheduled: reading event taskId=${readTaskId}, status=${sch.json.status}`)

// Count calendar events for this user that belong to media before the delete
const beforeTasks = db(`SELECT Id, SourceModule, Title FROM Tasks WHERE UserId=${uid} AND SourceModule LIKE 'media%';`)
console.log('Calendar media events BEFORE delete:', JSON.stringify(beforeTasks))

// Attacker-of-own-data deletes the READING event in the calendar module
const del = await api('DELETE', `/api/tasks/${readTaskId}`, { token: tok })
console.log(`DELETE /api/tasks/${readTaskId} -> ${del.status}`)

const mediaGone = db(`SELECT COUNT(*) FROM MediaItems WHERE Id=${mediaId};`)[0][0] === '0'
const afterTasks = db(`SELECT Id, SourceModule, Title FROM Tasks WHERE UserId=${uid} AND SourceModule LIKE 'media%';`)
console.log(`MediaItem deleted (cascade)=${mediaGone}`)
console.log('Calendar media events AFTER delete:', JSON.stringify(afterTasks))

const orphanExists = db(`SELECT COUNT(*) FROM Tasks WHERE Id=${returnTaskId};`)[0][0] === '1'
console.log('\n==== RESULT ====')
console.log(`Book removed by cascade: ${mediaGone}`)
console.log(`Return reminder (taskId=${returnTaskId}) still in calendar with NO owning book: ${orphanExists}`)
console.log(orphanExists && mediaGone
  ? 'CONFIRMED: orphaned "Повернути книгу" reminder — DeleteTaskAsync cascade does not clear ReturnTaskId'
  : 'REFUTED: no orphan')
