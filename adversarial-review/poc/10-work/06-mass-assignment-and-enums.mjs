// §8 / §6 — мертві поля (контакт: group/status/socials/viber; зобов'язання: dueDate/isDone) прибрано
// з request-моделей, тож прямий API більше не може їх підмінити. Невідомі енами й далі нормалізуються.
// FIXED (залишок 10-work/06): WorkContactRequest/WorkObligationRequest без мертвих полів; ToContactDto
// жорстко ставить group="", status="online", socials=null, viber=null; AddObligation/UpdateObligation
// пишуть лише title/note.
import { provision, api } from '../_lib/provision.mjs'
const line = (s) => console.log(s)

const tag = Math.random().toString(36).slice(2, 7)
const u = await provision({ email: `adv.t10.mass.${tag}@gmail.com`, isWorking: true })
line(`userId=${u.userId}`)

// 1) Контакт з мертвими полями — вони НЕ повинні зберегтися
const c = await api('POST', '/api/work/contacts', { token: u.token, body: {
  groupName: 'secret-group', status: 'busy', fullName: 'Mass Assign', phone: '+380991112233',
  socials: 'injected-socials', telegram: '@tg', viber: 'injected-viber' } })
const gc = ((await api('GET', '/api/work/contacts', { token: u.token })).json || []).find(x => x.fullName === 'Mass Assign')
line(`\n[contact] POST ${c.status}; stored status=${gc?.status} socials=${gc?.socials} viber=${gc?.viber} group="${gc?.groupName}"`)
const contactClean = gc && gc.status === 'online' && !gc.socials && !gc.viber && gc.groupName === ''

// 2) Зобов'язання з мертвими dueDate/isDone — вони НЕ повинні зберегтися
const o = await api('POST', '/api/work/obligations', { token: u.token, body: {
  title: 'Mass Obl', note: 'n', dueDate: '2026-12-31', isDone: true } })
let go = ((await api('GET', '/api/work/obligations', { token: u.token })).json || []).find(x => x.title === 'Mass Obl')
line(`[obligation] POST ${o.status}; stored dueDate=${go?.dueDate} isDone=${go?.isDone}`)
const up = await api('PUT', `/api/work/obligations/${go.id}`, { token: u.token, body: {
  title: 'Mass Obl', note: 'n', dueDate: '2026-12-31', isDone: true } })
go = ((await api('GET', '/api/work/obligations', { token: u.token })).json || []).find(x => x.id === go.id)
line(`  after PUT {isDone:true,dueDate} -> dueDate=${go?.dueDate} isDone=${go?.isDone}`)
const oblClean = go && !go.dueDate && go.isDone === false

// 3) Невідомі енами й далі нормалізуються до безпечних дефолтів
const bogusType = await api('POST', '/api/work/shift-types', { token: u.token, body: {
  name: 'enumtest', color: '#ffd59e', startTime: '09:00:00', endTime: '17:00:00', kind: 'HACKER_KIND' } })
const et = ((await api('GET', '/api/work/shift-types', { token: u.token })).json || []).find(x => x.name === 'enumtest')
const bogusProc = await api('POST', '/api/work/process', { token: u.token, body: { title: 'enumproc', status: 'HACKER_STATUS' } })
const ep = ((await api('GET', '/api/work/process', { token: u.token })).json || []).find(x => x.title === 'enumproc')
line(`\n[enum] shift kind 'HACKER_KIND'->'${et?.kind}'; process status 'HACKER_STATUS'->'${ep?.status}' (expect normal/planned)`)
const enumNorm = et?.kind === 'normal' && ep?.status === 'planned'

const refuted = contactClean && oblClean && enumNorm
line(`\n==== VERDICT ====`)
line(refuted
  ? 'REFUTED — мертві поля не зберігаються (контакт: status=online, socials/viber/group порожні; ' +
    'зобов\'язання: dueDate=null, isDone=false навіть після PUT), невідомі енами нормалізовано.'
  : `CONFIRMED/partial — contactClean=${contactClean} oblClean=${oblClean} enumNorm=${enumNorm}`)
