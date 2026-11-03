import { useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { parseInput } from '../../utils/nlp'
import { createTask } from '../../api/tasks'
import { addSubject } from '../../api/study'
import { combineDuration, splitDuration, todayApiDate } from '../../utils/date'
import './QuickAdd.css'

// Модулі, у які вміє класифікувати парсер (+ "звичайна"). none-модуль → "tasks".
const MODULES = ['tasks', 'shopping', 'media', 'food', 'health', 'study', 'work', 'finance', 'notes']

// Грубе зіставлення назв предметів (родовий відмінок «математики» ≈ «Математика»):
// порівнюємо перші літери основ без урахування регістру.
function sameSubject(a, b) {
  const norm = (x) => (x || '').trim().toLowerCase()
  const x = norm(a); const y = norm(b)
  if (!x || !y) return false
  const k = Math.min(5, x.length, y.length)
  return x.slice(0, k) === y.slice(0, k)
}

// Розпізнаний task → редагований рядок форми підтвердження.
function toRow(task) {
  const { hours, minutes } = splitDuration(task.durationMinutes || 0)
  const s = task.study || {}
  return {
    title: task.title,
    date: task.date,
    time: task.time,
    durH: hours,
    durM: minutes,
    module: task.module || 'tasks',
    ambiguous: task.ambiguous,
    raw: task.raw,
    inheritedDate: Boolean(task.inheritedDate),
    subject: s.subject || '',
    teacher: s.teacher || '',
    link: s.link || '',
    createSubject: false, // проставляємо під час розбору, якщо предмет новий
    include: Boolean(task.title), // задачі без назви лишаємо непозначеними, доки назву не додано
  }
}

// Швидке додавання задач із природномовного рядка (укр./англ.). Розбір — на правилах
// (utils/nlp), задачі ніколи не створюються автоматично: спершу екран підтвердження.
// subjects — наявні предмети Навчання (для зіставлення/створення); canAddSubjects —
// чи користувач школяр/студент (інакше предмет у Навчанні створити не можна).
export default function QuickAdd({ token, onCreated, subjects = [], canAddSubjects = false }) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null) // { tasks, notRecognized, language } або null
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const findSubject = (name) => subjects.find((s) => sameSubject(s.name, name))

  const handleParse = () => {
    setNote('')
    const parsed = parseInput(text)
    if (!parsed.tasks.length && !parsed.notRecognized.length) {
      setNote(t('quickAdd.nothing'))
      return
    }
    setResult(parsed)
    setRows(parsed.tasks.map((task) => {
      const r = toRow(task)
      // Новий предмет (є назва, але немає в Навчанні) — за замовчуванням пропонуємо додати.
      if (r.module === 'study' && r.subject && canAddSubjects && !findSubject(r.subject)) {
        r.createSubject = true
      }
      return r
    }))
  }

  const close = () => {
    setResult(null)
    setRows([])
  }

  const patch = (i, changes) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...changes } : r)))

  // Вибір для неоднозначного числа: застосувати дату/час і прибрати цей чузер із рядка.
  const chooseAmbiguous = (i, ambIndex, option) => {
    setRows((rs) => rs.map((r, idx) => {
      if (idx !== i) return r
      const next = { ...r, ambiguous: r.ambiguous.filter((_, k) => k !== ambIndex) }
      if (option && option.date) next.date = option.date
      if (option && option.time) next.time = option.time
      return next
    }))
  }

  const createAll = async () => {
    const toCreate = rows.filter((r) => r.include && r.title.trim())
    if (!toCreate.length) { close(); return }
    setBusy(true)
    try {
      for (const r of toCreate) {
        // Навчання: за потреби спершу створюємо предмет (помилка не зриває створення задачі).
        if (r.module === 'study' && r.createSubject && r.subject.trim() && canAddSubjects && !findSubject(r.subject)) {
          try {
            await addSubject({
              name: r.subject.trim(),
              teacher: r.teacher.trim() || null,
              color: null,
              lectureRoom: null,
              lectureLink: r.link.trim() || null,
              seminarRoom: null,
              seminarLink: null,
            })
          } catch { /* предмет не критичний — задачу все одно створюємо */ }
        }

        let startDateTime = null
        if (r.date) startDateTime = `${r.date}T${r.time || '09:00'}:00`
        else if (r.time) startDateTime = `${todayApiDate()}T${r.time}:00`
        await createTask(token, {
          title: r.title.trim(),
          description: null,
          startDateTime,
          durationMinutes: combineDuration(r.durH, r.durM),
          deadline: null,
          moduleCode: r.module,
        })
      }
      setNote(t('quickAdd.created', { count: toCreate.length }))
      setText('')
      close()
      onCreated?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="quick-add card">
      <div className="quick-add-bar">
        <input
          type="text"
          className="quick-add-input"
          value={text}
          placeholder={t('quickAdd.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleParse() } }}
        />
        <button type="button" className="btn-accent quick-add-btn" onClick={handleParse} disabled={!text.trim()}>
          <Icon name="sparkles" />
          {t('quickAdd.parse')}
        </button>
      </div>
      <p className="quick-add-hint">{t('quickAdd.hint')}</p>
      {note && !result && <p className="quick-add-note">{note}</p>}

      {result && (
        <div className="quick-add-modal-backdrop" onClick={close}>
          <div className="quick-add-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('quickAdd.modalTitle')}</h3>
            <p className="quick-add-modal-hint">{t('quickAdd.modalHint')}</p>

            <div className="quick-add-rows">
              {rows.map((r, i) => (
                <div className={`qa-row${r.include ? '' : ' qa-row--off'}`} key={i}>
                  <label className="qa-check">
                    <input type="checkbox" checked={r.include} onChange={(e) => patch(i, { include: e.target.checked })} />
                  </label>

                  <div className="qa-fields">
                    <label className="qa-field qa-field--title">
                      <span>{t('quickAdd.field.title')}</span>
                      <input type="text" value={r.title} onChange={(e) => patch(i, { title: e.target.value, include: r.include || Boolean(e.target.value.trim()) })} />
                      {!r.title.trim() && <small className="qa-warn">{t('quickAdd.titleRequired')}</small>}
                    </label>

                    <label className="qa-field">
                      <span><Icon name="calendar" /> {t('quickAdd.field.date')}</span>
                      <input type="date" value={r.date} onChange={(e) => patch(i, { date: e.target.value, inheritedDate: false })} />
                      {r.inheritedDate && <small className="qa-hint-inline">{t('quickAdd.inheritedDate')}</small>}
                    </label>

                    <label className="qa-field">
                      <span><Icon name="clock" /> {t('quickAdd.field.time')}</span>
                      <input type="time" value={r.time} onChange={(e) => patch(i, { time: e.target.value })} />
                    </label>

                    <div className="qa-field qa-field--dur">
                      <span>{t('quickAdd.field.duration')}</span>
                      <div className="qa-dur">
                        <input type="number" min="0" max="8" value={r.durH} onChange={(e) => patch(i, { durH: Number(e.target.value) || 0 })} />
                        <em>{t('quickAdd.hours')}</em>
                        <input type="number" min="0" max="59" value={r.durM} onChange={(e) => patch(i, { durM: Number(e.target.value) || 0 })} />
                        <em>{t('quickAdd.minutes')}</em>
                      </div>
                    </div>

                    <label className="qa-field">
                      <span><Icon name="tag" /> {t('quickAdd.field.module')}</span>
                      <select value={r.module} onChange={(e) => patch(i, { module: e.target.value })}>
                        {MODULES.map((code) => (
                          <option key={code} value={code}>{t(`quickAdd.module.${code}`)}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Навчання: предмет + викладач (+ пропозиція додати у Навчання, якщо новий) */}
                  {r.module === 'study' && (
                    <div className="qa-study">
                      <label className="qa-field">
                        <span>{t('quickAdd.field.subject')}</span>
                        <input type="text" value={r.subject} onChange={(e) => patch(i, { subject: e.target.value })} />
                      </label>
                      <label className="qa-field">
                        <span>{t('quickAdd.field.teacher')}</span>
                        <input type="text" value={r.teacher} onChange={(e) => patch(i, { teacher: e.target.value })} />
                      </label>
                      {canAddSubjects && r.subject.trim() && (
                        findSubject(r.subject) ? (
                          <span className="qa-study-found"><Icon name="check" /> {t('quickAdd.subjectFound')}</span>
                        ) : (
                          <label className="qa-study-new">
                            <input type="checkbox" checked={r.createSubject} onChange={(e) => patch(i, { createSubject: e.target.checked })} />
                            {t('quickAdd.subjectNew')}
                          </label>
                        )
                      )}
                    </div>
                  )}

                  {r.ambiguous.map((amb, ambIndex) => (
                    <div className="qa-ambiguous" key={ambIndex}>
                      <span className="qa-amb-label">{t('quickAdd.ambiguous', { raw: amb.raw })}</span>
                      <div className="qa-amb-opts">
                        {amb.options.map((opt) => (
                          <button type="button" key={opt.key} className="qa-amb-opt" onClick={() => chooseAmbiguous(i, ambIndex, opt)}>
                            {opt.key === 'day' ? t('quickAdd.opt.day', { n: amb.n }) : opt.time}
                          </button>
                        ))}
                        <button type="button" className="qa-amb-opt qa-amb-opt--skip" onClick={() => chooseAmbiguous(i, ambIndex, null)}>
                          {t('quickAdd.opt.skip')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {result.notRecognized.length > 0 && (
              <div className="qa-unrec">
                <div className="qa-unrec-title"><Icon name="warning" /> {t('quickAdd.notRecognized')}</div>
                <p className="qa-unrec-hint">{t('quickAdd.notRecognizedHint')}</p>
                <ul>{result.notRecognized.map((frag, k) => <li key={k}>{frag}</li>)}</ul>
              </div>
            )}

            <div className="quick-add-modal-actions">
              <button type="button" className="btn-ghost" onClick={close} disabled={busy}>{t('common.cancel')}</button>
              <button type="button" className="btn-accent" onClick={createAll} disabled={busy || !rows.some((r) => r.include && r.title.trim())}>
                {busy ? t('quickAdd.creating') : t('quickAdd.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
