// ПЛАН P3-6 — swagger.json у Development більше не падає у 500. Причина була: два вкладені типи з
// однаковою назвою Recurrence (WorkService.Recurrence і StudyService.Recurrence) давали однаковий
// default schemaId → колізія. FIXED: Program.cs SwaggerGen CustomSchemaIds = повне імʼя типу.
// (Поза Development Swagger вимкнений — цей PoC має сенс лише на dev-сервері :5080.)
const base = process.env.BASE || 'http://localhost:5080'

const r = await fetch(`${base}/swagger/v1/swagger.json`)
const text = await r.text()
const hasWork = text.includes('WorkService.Recurrence')
const hasStudy = text.includes('StudyService.Recurrence')
console.log(`GET /swagger/v1/swagger.json -> ${r.status}; WorkService.Recurrence=${hasWork} StudyService.Recurrence=${hasStudy}`)

const refuted = r.status === 200 && hasWork && hasStudy
console.log('\n' + (refuted
  ? 'REFUTED — swagger.json генерується (200), обидві схеми Recurrence присутні з унікальними id. Колізії schemaId немає.'
  : `CONFIRMED/partial — status=${r.status} work=${hasWork} study=${hasStudy}`))
