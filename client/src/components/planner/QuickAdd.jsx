import { useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { parseInput } from '../../utils/nlp'
import { createTask } from '../../api/tasks'
import { combineDuration, splitDuration, todayApiDate } from '../../utils/date'
import './QuickAdd.css'

// Модулі, у які вміє класифікувати парсер (+ "звичайна"). none-модуль → "tasks".
const MODULES = ['tasks', 'shopping', 'media', 'food']

// Розпізнаний task → редагований рядок форми підтвердження.
function toRow(task) {
  const { hours, minutes } = splitDuration(task.durationMinutes || 0)
  return {
    title: task.title,
    date: task.date,
    time: task.time,
    durH: hours,
    durM: minutes,
    module: task.module || 'tasks',
    ambiguous: task.ambiguous,
    raw: task.raw,
    include: Boolean(task.title), // задачі без назви лишаємо непозначеними, доки назву не додано
  }
}

// Швидке додавання задач із природномовного рядка (укр./англ.). Розбір — на правилах
// (utils/nlp), задачі ніколи не створюються автоматично: спершу екран підтвердження.
export default function QuickAdd({ token, onCreated }) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null) // { tasks, notRecognized, language } або null
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const handleParse = () => {
    setNote('')
    const parsed = parseInput(text)
    if (!parsed.tasks.length && !parsed.notRecognized.length) {
      setNote(t('quickAdd.nothing'))
      return
    }
    setResult(parsed)
    setRows(parsed.tasks.map(toRow))
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
      <div className="quick-add-head">
        <Icon name="sparkles" />
        <span>{t('quickAdd.heading')}</span>
      </div>
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
                      <input type="date" value={r.date} onChange={(e) => patch(i, { date: e.target.value })} />
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
