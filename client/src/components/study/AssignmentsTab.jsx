import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getAssignments, addAssignment, updateAssignment, removeAssignment } from '../../api/study'
import { DEADLINE_KINDS, PUPIL_ASSIGNMENT_TYPES, STUDENT_ASSIGNMENT_TYPES } from './studyShared'

const DESCRIPTION_MAX = 300 // приблизно три речення

// Завдання. Назви немає — спершу вид роботи, далі обов'язковий опис. Дедлайн обов'язковий.
// Оцінка з'являється лише коли "виконано": школяр 0/1–12, студент 0–100 (до сотих).
export default function AssignmentsTab({ subjects, isPupil }) {
  const { t } = useI18n()
  const types = isPupil ? PUPIL_ASSIGNMENT_TYPES : STUDENT_ASSIGNMENT_TYPES
  const emptyForm = { subjectId: '', type: types[0], description: '', deadlineKind: 'tomorrow', dueDate: '' }

  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [sort, setSort] = useState('deadline')

  const reload = async () => setItems(await getAssignments())
  useEffect(() => { reload() }, [])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.description.trim()) return
    await addAssignment({
      subjectId: form.subjectId ? Number(form.subjectId) : null,
      type: form.type,
      description: form.description.trim(),
      deadlineKind: form.deadlineKind,
      dueDate: form.deadlineKind === 'date' ? form.dueDate || null : null,
      isDone: false,
      grade: null,
    })
    setForm(emptyForm)
    await reload()
  }

  // Будь-яка зміна (done/grade) пише увесь запис назад
  const patchItem = async (a, patch) => {
    const next = { ...a, ...patch }
    setItems((prev) => prev.map((x) => (x.id === a.id ? next : x)))
    await updateAssignment(a.id, {
      subjectId: next.subjectId ?? null,
      type: next.type,
      description: next.description,
      deadlineKind: next.deadlineKind,
      dueDate: next.deadlineKind === 'date' ? next.dueDate : null,
      isDone: next.isDone,
      grade: next.isDone ? next.grade : null,
    })
  }

  const remove = async (id) => {
    await removeAssignment(id)
    await reload()
  }

  const sorted = useMemo(() => {
    const copy = [...items]
    if (sort === 'subject') copy.sort((a, b) => (a.subjectName ?? '').localeCompare(b.subjectName ?? ''))
    else if (sort === 'teacher') copy.sort((a, b) => (a.teacher ?? '').localeCompare(b.teacher ?? ''))
    else copy.sort((a, b) => (a.resolvedDeadline ?? '9999').localeCompare(b.resolvedDeadline ?? '9999'))
    return copy
  }, [items, sort])

  return (
    <div className="card">
      <form className="study-form" onSubmit={submit}>
        {!isPupil && (
          <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
            {types.map((ty) => (
              <option key={ty} value={ty}>{t(`study.type.${ty}`)}</option>
            ))}
          </select>
        )}
        <select value={form.subjectId} onChange={(e) => set({ subjectId: e.target.value })}>
          <option value="">{t('study.noSubject')}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select value={form.deadlineKind} onChange={(e) => set({ deadlineKind: e.target.value })}>
          {DEADLINE_KINDS.map((k) => (
            <option key={k} value={k}>{t(`study.deadline.${k}`)}</option>
          ))}
        </select>
        {/* Своя дата доступна завжди: обравши дату, автоматично перемикаємося на "До дати" */}
        <input
          type="date"
          className="time-field"
          title={t('study.deadline.date')}
          value={form.dueDate}
          onChange={(e) => set({ dueDate: e.target.value, deadlineKind: e.target.value ? 'date' : form.deadlineKind })}
        />
        <textarea
          className="study-textarea"
          rows={2}
          maxLength={DESCRIPTION_MAX}
          placeholder={t('study.assignmentDescription')}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
        <div className="study-form-actions">
          <button type="submit" className="btn-accent" disabled={!form.description.trim()}>
            {t('study.addAssignment')}
          </button>
        </div>
      </form>

      <div className="study-sort">
        <span>{t('study.sortBy')}</span>
        {['deadline', 'subject', 'teacher'].map((key) => (
          <button
            key={key}
            type="button"
            className={sort === key ? 'pill pill--active' : 'pill'}
            onClick={() => setSort(key)}
          >
            {t(`study.sort.${key}`)}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="placeholder-text">{t('study.assignmentsEmpty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('study.col.type')}</th>
                <th>{t('study.col.task')}</th>
                <th>{t('study.col.subject')}</th>
                <th>{t('study.col.deadline')}</th>
                <th>{t('study.col.status')}</th>
                <th>{t('study.col.grade')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.id}>
                  <td>{t(`study.type.${a.type}`)}</td>
                  <td className="study-desc-cell">{a.description}</td>
                  <td>{a.subjectName || <span className="none-text">—</span>}</td>
                  <td>{a.resolvedDeadline || <span className="none-text">—</span>}</td>
                  <td>
                    <label className="study-done-toggle" title={t('study.toggleDone')}>
                      <input type="checkbox" checked={a.isDone} onChange={() => patchItem(a, { isDone: !a.isDone })} />
                      <span className={`badge ${a.isDone ? 'badge--ok' : 'badge--warn'}`}>
                        {a.isDone ? t('study.status.done') : t('study.status.notDone')}
                      </span>
                    </label>
                  </td>
                  <td>
                    {a.isDone ? (
                      <GradeInput isPupil={isPupil} value={a.grade} onChange={(g) => patchItem(a, { grade: g })} />
                    ) : (
                      <span className="none-text">—</span>
                    )}
                  </td>
                  <td className="study-row-actions">
                    <button
                      type="button"
                      className="study-icon-btn study-icon-btn--danger"
                      onClick={() => remove(a.id)}
                      aria-label={t('planner.actionDelete')}
                      data-tooltip={t('planner.actionDelete')}
                    >
                      <Icon name="trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Школяр: вибір 0 або 1–12. Студент: число 0–100 з сотими.
function GradeInput({ isPupil, value, onChange }) {
  if (isPupil) {
    return (
      <select
        className="study-grade-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">—</option>
        {Array.from({ length: 13 }, (_, i) => i).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    )
  }
  return (
    <input
      type="number"
      className="study-grade-input"
      min="0"
      max="100"
      step="0.01"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  )
}
