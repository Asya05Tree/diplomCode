// §10 — server accepts Deadline/StartDateTime in the past (client checks, API does not).
// §8 — mass-assignment: Status/RecurrenceRuleId/SourceModule cannot be set via Create.
// (IsPinned прибрано з моделі в сесії 13 — колонки більше немає, цей вектор зник.)
import { provision, api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'

const A = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })

// past deadline + past start
const r1 = await api('POST', '/api/tasks', { token: A.token, body: {
  Title: 'past-dl', Deadline: '2000-01-01T23:59:00', StartDateTime: '2000-01-01T09:00:00' }})
console.log('create task with past deadline + past start ->', r1.status)
const id1 = r1.json?.Id ?? r1.json?.id

// mass-assignment attempt: try to inject Status/IsPinned/RecurrenceRuleId/SourceModule
const r2 = await api('POST', '/api/tasks', { token: A.token, body: {
  Title: 'mass', StartDateTime: '2030-01-01T09:00:00',
  Status: 'Done', RecurrenceRuleId: 123456, SourceModule: 'media', SourceEntityId: 777 }})
console.log('create task with injected Status/RecurrenceRuleId/SourceModule ->', r2.status)
const id2 = r2.json?.Id ?? r2.json?.id

const row = execFileSync('docker', ['exec','planner-mysql','mysql','-N','-uplanner','-pplanner_dev_password','planner','-e',
  `SELECT Status,IFNULL(RecurrenceRuleId,'NULL'),IFNULL(SourceModule,'NULL'),IFNULL(SourceEntityId,'NULL') FROM Tasks WHERE Id=${id2};`],
  { encoding:'utf8' }).trim().split(/\t/)
console.log('DB row for injected task:', { Status: row[0], RecurrenceRuleId: row[1], SourceModule: row[2], SourceEntityId: row[3] })

for (const id of [id1, id2]) if (id) await api('DELETE', `/api/tasks/${id}`, { token: A.token })

const pastOk = r1.status === 200
const massBlocked = row[0] === 'Planned' && row[1] === 'NULL' && row[2] === 'NULL'
console.log('\nCONFIRMED — past deadline/start accepted by API:', pastOk ? 'yes (no server-side past check)' : 'no')
console.log((massBlocked ? 'REFUTED (secure)' : 'CONFIRMED') +
  ' — mass-assignment of Status/RecurrenceRuleId/SourceModule: ' +
  (massBlocked ? 'ignored (DTO has no such fields) → task stays Planned/no-source' : 'LEAKED: ' + JSON.stringify(row)))
