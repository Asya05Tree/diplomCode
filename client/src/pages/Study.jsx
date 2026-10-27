import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import NumberStepper from '../components/NumberStepper'
import {
  getSubjects,
  addSubject,
  updateSubject,
  removeSubject,
  getAssignments,
  addAssignment,
  updateAssignment,
  removeAssignment,
  getBells,
  setBells as apiSetBells,
  getGradeScale,
  setGradeScale as apiSetGradeScale,
} from '../api/study'
import { getRecurrenceRules } from '../api/tasks'
import { getToken } from '../api/http'
import './Study.css'

// Розділ "Навчання" (мокап mockups/study-variants/variant-4 — чотири великі плитки-вкладки).
// Тепер усе з бекенда: предмети, завдання, сітка дзвінків і шкала оцінок редагуються й
// зберігаються в БД (/api/study). Сам розклад пар живе як повторювані задачі з ModuleCode="study"
// (api/recurrence-rules) — тут це перегляд лише для читання.

const ASSIGNMENT_TYPES = ['homework', 'lab', 'exam', 'project', 'other']

const EMPTY_SUBJECT = { id: null, nameUk: '', nameEn: '', teacher: '', room: '' }
const EMPTY_ASSIGNMENT = { subjectId: '', type: 'homework', title: '', dueDate: '', isDone: false }

const TABS = [
  { key: 'subjects', icon: 'user' },
  { key: 'assignments', icon: 'clipboard' },
  { key: 'bells', icon: 'bell' },
  { key: 'schedule', icon: 'calendar-days' },
]

export default function Study() {
  const { t, language } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [tab, setTab] = useState('subjects')

  const [subjects, setSubjects] = useState([])
  const [assignments, setAssignments] = useState([])
  const [bells, setBells] = useState([]) // локальна редагована копія сітки дзвінків
  const [gradeScale, setGradeScale] = useState([]) // локальна редагована копія шкали
  const [rules, setRules] = useState([]) // розклад пар (перегляд)

  const [subjectForm, setSubjectForm] = useState(EMPTY_SUBJECT)
  const [assignmentForm, setAssignmentForm] = useState(EMPTY_ASSIGNMENT)
  const [savedNote, setSavedNote] = useState('') // короткочасне "Збережено"

  useEffect(() => {
    let cancelled = false
    Promise.all([getSubjects(), getAssignments(), getBells(), getGradeScale()])
      .then(([subs, asg, bl, gs]) => {
        if (cancelled) return
        setSubjects(subs)
        setAssignments(asg)
        setBells(bl.map((b) => ({ index: b.index, startTime: b.startTime.slice(0, 5), endTime: b.endTime.slice(0, 5) })))
        setGradeScale(gs.map((g) => ({ minPercent: g.minPercent, label: g.label })))
        setLoading(false)
        // Розклад — другорядний перегляд: вантажимо окремо, помилка не ламає сторінку.
        getRecurrenceRules(getToken())
          .then((list) => !cancelled && setRules((list || []).filter((r) => r.moduleCode === 'study')))
          .catch(() => {})
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects])
  const subjectName = (s) => (language === 'en' && s?.nameEn ? s.nameEn : s?.nameUk)

  const flashSaved = () => {
    setSavedNote(t('study.saved'))
    setTimeout(() => setSavedNote(''), 1800)
  }

  // ---- Предмети ----
  const reloadSubjects = async () => setSubjects(await getSubjects())

  const handleSubjectSubmit = async (e) => {
    e.preventDefault()
    const nameUk = subjectForm.nameUk.trim()
    if (!nameUk) return
    const payload = {
      nameUk,
      nameEn: subjectForm.nameEn.trim() || null,
      teacher: subjectForm.teacher.trim() || null,
      room: subjectForm.room.trim() || null,
    }
    if (subjectForm.id) await updateSubject(subjectForm.id, payload)
    else await addSubject(payload)
    setSubjectForm(EMPTY_SUBJECT)
    await reloadSubjects()
  }

  const editSubject = (s) =>
    setSubjectForm({ id: s.id, nameUk: s.nameUk, nameEn: s.nameEn ?? '', teacher: s.teacher ?? '', room: s.room ?? '' })

  const handleRemoveSubject = async (id) => {
    await removeSubject(id)
    if (subjectForm.id === id) setSubjectForm(EMPTY_SUBJECT)
    await reloadSubjects()
  }

  // ---- Завдання ----
  const reloadAssignments = async () => setAssignments(await getAssignments())

  const handleAssignmentSubmit = async (e) => {
    e.preventDefault()
    const title = assignmentForm.title.trim()
    if (!title) return
    await addAssignment({
      subjectId: assignmentForm.subjectId ? Number(assignmentForm.subjectId) : null,
      type: assignmentForm.type,
      title,
      dueDate: assignmentForm.dueDate || null,
      isDone: assignmentForm.isDone,
    })
    setAssignmentForm(EMPTY_ASSIGNMENT)
    await reloadAssignments()
  }

  const toggleAssignmentDone = async (a) => {
    setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, isDone: !x.isDone } : x)))
    await updateAssignment(a.id, {
      subjectId: a.subjectId ?? null,
      type: a.type,
      title: a.title,
      dueDate: a.dueDate ?? null,
      isDone: !a.isDone,
    })
  }

  const handleRemoveAssignment = async (id) => {
    await removeAssignment(id)
    await reloadAssignments()
  }

  // ---- Дзвінки (замінюємо всю сітку) ----
  const handleBellChange = (idx, edge, value) =>
    setBells((prev) => prev.map((row, i) => (i === idx ? { ...row, [edge]: value } : row)))

  const addBellRow = () =>
    setBells((prev) => [...prev, { index: prev.length + 1, startTime: '08:30', endTime: '09:50' }])

  const removeBellRow = (idx) =>
    setBells((prev) => prev.filter((_, i) => i !== idx).map((row, i) => ({ ...row, index: i + 1 })))

  const saveBells = async () => {
    await apiSetBells(bells.map((b, i) => ({ index: i + 1, startTime: `${b.startTime}:00`, endTime: `${b.endTime}:00` })))
    flashSaved()
  }

  // ---- Шкала оцінок (замінюємо всю шкалу) ----
  const handleGradeChange = (idx, field, value) =>
    setGradeScale((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)))

  const addGradeRow = () => setGradeScale((prev) => [...prev, { minPercent: 0, label: '' }])

  const removeGradeRow = (idx) => setGradeScale((prev) => prev.filter((_, i) => i !== idx))

  const saveGradeScale = async () => {
    const scale = gradeScale
      .filter((g) => g.label.trim())
      .map((g) => ({ minPercent: Math.max(0, Math.min(100, Number(g.minPercent) || 0)), label: g.label.trim() }))
    await apiSetGradeScale(scale)
    flashSaved()
  }

  const weekdayLabels = t('planner.weekdaysShort').split(',')
  const summarizeRule = (rule) => {
    const time = (rule.timeOfDay || '').slice(0, 5)
    if (rule.type === 'WeekCycle') {
      const days = new Set()
      for (const part of (rule.weekDaysPattern ?? '').split('|').filter(Boolean)) {
        const list = part.split(':')[1] ?? ''
        for (const d of list.split(',').filter(Boolean)) days.add(Number(d))
      }
      const labels = [...days].sort((a, b) => a - b).map((d) => weekdayLabels[d - 1]).join(', ')
      return `${labels || '—'}${time ? ` · ${time}` : ''}`
    }
    return `${t(`recurrence.type.${rule.type}`)}${time ? ` · ${time}` : ''}`
  }

  const tabMeta = {
    subjects: t('study.tab.subjectsMeta', { count: subjects.length }),
    assignments: t('study.tab.assignmentsMeta', { count: assignments.length }),
    bells: t('study.tab.bellsMeta', { count: bells.length }),
    schedule: t('study.tab.scheduleMetaView', { count: rules.length }),
  }

  if (loading) {
    return (
      <div className="study-page">
        <p className="placeholder-text">{t('common.loading')}</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="study-page">
        <p className="placeholder-text">{t('common.error')}</p>
      </div>
    )
  }

  return (
    <div className="study-page">
      <div className="page-head">
        <h2>{t('nav.study')}</h2>
        <span className="variant-note">{t('study.note')}</span>
      </div>

      <div className="study-tabs">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'study-tab study-tab--active' : 'study-tab'}
            onClick={() => setTab(item.key)}
          >
            <span className="study-tab-icon"><Icon name={item.icon} /></span>
            <span className="study-tab-title">{t(`study.tab.${item.key}`)}</span>
            <span className="study-tab-meta">{tabMeta[item.key]}</span>
          </button>
        ))}
      </div>

      {tab === 'subjects' && (
        <div className="card">
          <form className="study-form" onSubmit={handleSubjectSubmit}>
            <input
              type="text"
              placeholder={t('study.subjectNameUk')}
              value={subjectForm.nameUk}
              onChange={(e) => setSubjectForm((f) => ({ ...f, nameUk: e.target.value }))}
            />
            <input
              type="text"
              placeholder={t('study.subjectNameEn')}
              value={subjectForm.nameEn}
              onChange={(e) => setSubjectForm((f) => ({ ...f, nameEn: e.target.value }))}
            />
            <input
              type="text"
              placeholder={t('study.subjectTeacher')}
              value={subjectForm.teacher}
              onChange={(e) => setSubjectForm((f) => ({ ...f, teacher: e.target.value }))}
            />
            <input
              type="text"
              placeholder={t('study.subjectRoom')}
              value={subjectForm.room}
              onChange={(e) => setSubjectForm((f) => ({ ...f, room: e.target.value }))}
            />
            <div className="study-form-actions">
              {subjectForm.id && (
                <button type="button" className="btn-ghost" onClick={() => setSubjectForm(EMPTY_SUBJECT)}>
                  {t('study.cancelEdit')}
                </button>
              )}
              <button type="submit" className="btn-accent" disabled={!subjectForm.nameUk.trim()}>
                {subjectForm.id ? t('study.saveSubject') : t('study.addSubject')}
              </button>
            </div>
          </form>

          {subjects.length === 0 ? (
            <p className="placeholder-text">{t('study.subjectsEmpty')}</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('study.col.subject')}</th>
                    <th>{t('study.col.teacher')}</th>
                    <th>{t('study.col.room')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span className="study-subject-name">
                          {s.color && <span className="cat-dot" style={{ background: s.color }} />}
                          {subjectName(s)}
                        </span>
                      </td>
                      <td>{s.teacher || <span className="none-text">—</span>}</td>
                      <td>{s.room || <span className="none-text">—</span>}</td>
                      <td className="study-row-actions">
                        <button
                          type="button"
                          className="study-icon-btn"
                          onClick={() => editSubject(s)}
                          aria-label={t('planner.actionEdit')}
                          data-tooltip={t('planner.actionEdit')}
                        >
                          <Icon name="pencil" />
                        </button>
                        <button
                          type="button"
                          className="study-icon-btn study-icon-btn--danger"
                          onClick={() => handleRemoveSubject(s.id)}
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
      )}

      {tab === 'assignments' && (
        <div className="card">
          <form className="study-form" onSubmit={handleAssignmentSubmit}>
            <input
              type="text"
              placeholder={t('study.assignmentTitle')}
              value={assignmentForm.title}
              onChange={(e) => setAssignmentForm((f) => ({ ...f, title: e.target.value }))}
            />
            <select
              value={assignmentForm.subjectId}
              onChange={(e) => setAssignmentForm((f) => ({ ...f, subjectId: e.target.value }))}
            >
              <option value="">{t('study.noSubject')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {subjectName(s)}
                </option>
              ))}
            </select>
            <select
              value={assignmentForm.type}
              onChange={(e) => setAssignmentForm((f) => ({ ...f, type: e.target.value }))}
            >
              {ASSIGNMENT_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`study.type.${ty}`)}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="time-field"
              value={assignmentForm.dueDate}
              onChange={(e) => setAssignmentForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
            <div className="study-form-actions">
              <button type="submit" className="btn-accent" disabled={!assignmentForm.title.trim()}>
                {t('study.addAssignment')}
              </button>
            </div>
          </form>

          {assignments.length === 0 ? (
            <p className="placeholder-text">{t('study.assignmentsEmpty')}</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('study.col.task')}</th>
                    <th>{t('study.col.subject')}</th>
                    <th>{t('study.col.type')}</th>
                    <th>{t('study.col.deadline')}</th>
                    <th>{t('study.col.status')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>
                        {a.subjectId && subjectsById[a.subjectId] ? (
                          subjectName(subjectsById[a.subjectId])
                        ) : (
                          <span className="none-text">—</span>
                        )}
                      </td>
                      <td>{t(`study.type.${a.type}`)}</td>
                      <td>{a.dueDate || <span className="none-text">—</span>}</td>
                      <td>
                        <label className="study-done-toggle" title={t('study.toggleDone')}>
                          <input type="checkbox" checked={a.isDone} onChange={() => toggleAssignmentDone(a)} />
                          <span className={`badge ${a.isDone ? 'badge--ok' : 'badge--warn'}`}>
                            {a.isDone ? t('study.status.done') : t('study.status.notDone')}
                          </span>
                        </label>
                      </td>
                      <td className="study-row-actions">
                        <button
                          type="button"
                          className="study-icon-btn study-icon-btn--danger"
                          onClick={() => handleRemoveAssignment(a.id)}
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

          {/* Шкала оцінок — редагується цілою сіткою (PUT) */}
          <div className="grade-block">
            <div className="grade-head">
              <h4>{t('study.gradeScaleTitle')}</h4>
              <div className="grade-switch">
                {savedNote && <span className="study-saved-note">{savedNote}</span>}
                <button type="button" className="pill" onClick={addGradeRow}>
                  <Icon name="plus" /> {t('study.addGradeRow')}
                </button>
                <button type="button" className="btn-accent" onClick={saveGradeScale}>
                  {t('study.saveGradeScale')}
                </button>
              </div>
            </div>
            <p className="placeholder-text">{t('study.gradeScaleHint')}</p>
            {gradeScale.length === 0 ? (
              <p className="placeholder-text">{t('study.gradeScaleEmpty')}</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('study.gradeMinPercent')}</th>
                      <th>{t('study.gradeLabel')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {gradeScale.map((g, i) => (
                      <tr key={i}>
                        <td>
                          <NumberStepper
                            min={0}
                            max={100}
                            value={String(g.minPercent)}
                            onChange={(v) => handleGradeChange(i, 'minPercent', v)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="time-field"
                            value={g.label}
                            onChange={(e) => handleGradeChange(i, 'label', e.target.value)}
                          />
                        </td>
                        <td className="study-row-actions">
                          <button
                            type="button"
                            className="study-icon-btn study-icon-btn--danger"
                            onClick={() => removeGradeRow(i)}
                            aria-label={t('planner.actionDelete')}
                            data-tooltip={t('planner.actionDelete')}
                          >
                            <Icon name="close" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'bells' && (
        <div className="card">
          <div className="grade-head">
            <h4>{t('study.tab.bells')}</h4>
            <div className="grade-switch">
              {savedNote && <span className="study-saved-note">{savedNote}</span>}
              <button type="button" className="pill" onClick={addBellRow}>
                <Icon name="plus" /> {t('study.addBell')}
              </button>
              <button type="button" className="btn-accent" onClick={saveBells}>
                {t('study.saveBells')}
              </button>
            </div>
          </div>
          {bells.length === 0 ? (
            <p className="placeholder-text">{t('study.bellsEmpty')}</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('study.col.pair')}</th>
                    <th>{t('study.col.start')}</th>
                    <th>{t('study.col.end')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bells.map((row, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        <input
                          type="time"
                          className="time-field"
                          value={row.startTime}
                          onChange={(e) => handleBellChange(i, 'startTime', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          className="time-field"
                          value={row.endTime}
                          onChange={(e) => handleBellChange(i, 'endTime', e.target.value)}
                        />
                      </td>
                      <td className="study-row-actions">
                        <button
                          type="button"
                          className="study-icon-btn study-icon-btn--danger"
                          onClick={() => removeBellRow(i)}
                          aria-label={t('planner.actionDelete')}
                          data-tooltip={t('planner.actionDelete')}
                        >
                          <Icon name="close" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'schedule' && (
        <div className="card">
          <p className="placeholder-text">{t('study.scheduleViewNote')}</p>
          {rules.length === 0 ? (
            <p className="placeholder-text">{t('study.scheduleEmpty')}</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table schedule-table">
                <thead>
                  <tr>
                    <th>{t('study.col.subject')}</th>
                    <th>{t('study.scheduleWhen')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <span className="schedule-cell">
                          <strong>{rule.title}</strong>
                        </span>
                      </td>
                      <td>{summarizeRule(rule)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
