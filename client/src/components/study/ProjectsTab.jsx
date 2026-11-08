import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import FieldHelp from '../FieldHelp'
import {
  getProjects, addProject, removeProject,
  addProjectStep, updateProjectStep, removeProjectStep,
} from '../../api/study'
import { PROJECT_KINDS, DEADLINE_KINDS } from './studyShared'

// Великі роботи студента: диплом / курсова / практика. Поля однакові; обираємо вид угорі.
// Кожна робота має кроки (назва, дати, виконано); відсоток рахується автоматично (виконані / усі).
export default function ProjectsTab() {
  const { t } = useI18n()
  const [kind, setKind] = useState('diploma')
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState({ name: '', curator: '', deadlineKind: '', dueDate: '' })

  const reload = async (k = kind) => setProjects(await getProjects(k))
  useEffect(() => { reload(kind) }, [kind])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    await addProject({
      kind,
      name: form.name.trim(),
      curator: form.curator.trim() || null,
      deadlineKind: form.deadlineKind || null,
      dueDate: form.deadlineKind === 'date' ? form.dueDate || null : null,
    })
    setForm({ name: '', curator: '', deadlineKind: '', dueDate: '' })
    await reload()
  }

  return (
    <div className="card">
      <div className="study-seg study-seg--inline">
        {PROJECT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={kind === k ? 'study-seg-btn study-seg-btn--active' : 'study-seg-btn'}
            onClick={() => setKind(k)}
          >
            {t(`study.projectKind.${k}`)}
          </button>
        ))}
      </div>

      <form className="study-form" onSubmit={submit}>
        <div className="study-field-with-help">
          <input type="text" placeholder={t('study.projectName')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <FieldHelp text={t('study.projectNameHelp')} label={t('fieldHelp.label')} />
        </div>
        <div className="study-field-with-help">
          <input type="text" placeholder={t('study.curator')} value={form.curator} onChange={(e) => setForm((f) => ({ ...f, curator: e.target.value }))} />
          <FieldHelp text={t('study.curatorHelp')} label={t('fieldHelp.label')} />
        </div>
        <select value={form.deadlineKind} onChange={(e) => setForm((f) => ({ ...f, deadlineKind: e.target.value }))}>
          <option value="">{t('study.noDeadline')}</option>
          {DEADLINE_KINDS.map((k) => (
            <option key={k} value={k}>{t(`study.deadline.${k}`)}</option>
          ))}
        </select>
        {form.deadlineKind === 'date' && (
          <input type="date" className="time-field" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
        )}
        <div className="study-form-actions">
          <button type="submit" className="btn-accent" disabled={!form.name.trim()}>{t('study.addProject')}</button>
        </div>
      </form>

      {projects.length === 0 ? (
        <p className="placeholder-text">{t('study.projectsEmpty')}</p>
      ) : (
        projects.map((p) => <ProjectCard key={p.id} project={p} reload={reload} />)
      )}
    </div>
  )
}

function ProjectCard({ project, reload }) {
  const { t } = useI18n()
  const [step, setStep] = useState({ name: '', startDate: '', endDate: '' })

  const addStep = async (e) => {
    e.preventDefault()
    if (!step.name.trim()) return
    await addProjectStep(project.id, {
      name: step.name.trim(),
      startDate: step.startDate || null,
      endDate: step.endDate || null,
      isDone: false,
    })
    setStep({ name: '', startDate: '', endDate: '' })
    await reload()
  }

  const toggle = async (s) => {
    await updateProjectStep(s.id, { name: s.name, startDate: s.startDate, endDate: s.endDate, isDone: !s.isDone })
    await reload()
  }

  const delStep = async (id) => {
    await removeProjectStep(id)
    await reload()
  }

  const delProject = async () => {
    await removeProject(project.id)
    await reload()
  }

  return (
    <div className="study-project">
      <div className="study-project-head">
        <div>
          <h4>{project.name}</h4>
          {project.curator && <p className="study-project-curator">{t('study.curator')}: {project.curator}</p>}
          {project.resolvedDeadline && <p className="study-project-curator">{t('study.col.deadline')}: {project.resolvedDeadline}</p>}
        </div>
        <button type="button" className="study-icon-btn study-icon-btn--danger" onClick={delProject} data-tooltip={t('planner.actionDelete')}>
          <Icon name="trash" />
        </button>
      </div>

      <div className="study-progress">
        <div className="study-progress-bar"><span style={{ width: `${project.percent}%` }} /></div>
        <span className="study-progress-label">{project.percent}%</span>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('study.stepName')}</th>
              <th>{t('study.col.start')}</th>
              <th>{t('study.col.end')}</th>
              <th>{t('study.col.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {project.steps.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.startDate || <span className="none-text">—</span>}</td>
                <td>{s.endDate || <span className="none-text">—</span>}</td>
                <td>
                  <label className="study-done-toggle">
                    <input type="checkbox" checked={s.isDone} onChange={() => toggle(s)} />
                    <span className={`badge ${s.isDone ? 'badge--ok' : 'badge--warn'}`}>
                      {s.isDone ? t('study.status.done') : t('study.status.notDone')}
                    </span>
                  </label>
                </td>
                <td className="study-row-actions">
                  <button type="button" className="study-icon-btn study-icon-btn--danger" onClick={() => delStep(s.id)} data-tooltip={t('planner.actionDelete')}>
                    <Icon name="close" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="study-step-form" onSubmit={addStep}>
        <div className="study-field-with-help">
          <input type="text" placeholder={t('study.stepName')} value={step.name} onChange={(e) => setStep((s) => ({ ...s, name: e.target.value }))} />
          <FieldHelp text={t('study.stepNameHelp')} label={t('fieldHelp.label')} />
        </div>
        <input type="date" value={step.startDate} onChange={(e) => setStep((s) => ({ ...s, startDate: e.target.value }))} />
        <input type="date" value={step.endDate} onChange={(e) => setStep((s) => ({ ...s, endDate: e.target.value }))} />
        <button type="submit" className="pill" disabled={!step.name.trim()}><Icon name="plus" /> {t('study.addStep')}</button>
      </form>
    </div>
  )
}
