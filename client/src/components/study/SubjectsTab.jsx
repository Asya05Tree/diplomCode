import { useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { addSubject, updateSubject, removeSubject } from '../../api/study'
import { roomLinkVisibility } from './studyShared'

const EMPTY = { id: null, name: '', teacher: '', lectureRoom: '', lectureLink: '', seminarRoom: '', seminarLink: '' }

// Предмети. Назва + викладач обов'язкові. Поля кабінет/посилання залежать від форми навчання,
// а поділ лекція/семінар — лише у студента (школяр має один набір "заняття" = Lecture*).
export default function SubjectsTab({ subjects, reloadSubjects, learningForm, isPupil }) {
  const { t } = useI18n()
  const [form, setForm] = useState(EMPTY)
  const { showRoom, showLink } = roomLinkVisibility(learningForm)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const canSave = form.name.trim() && form.teacher.trim()

  const submit = async (e) => {
    e.preventDefault()
    if (!canSave) return
    const payload = {
      name: form.name.trim(),
      teacher: form.teacher.trim(),
      color: null,
      lectureRoom: form.lectureRoom.trim() || null,
      lectureLink: form.lectureLink.trim() || null,
      // Школяр не має семінару — не надсилаємо його поля
      seminarRoom: isPupil ? null : form.seminarRoom.trim() || null,
      seminarLink: isPupil ? null : form.seminarLink.trim() || null,
    }
    if (form.id) await updateSubject(form.id, payload)
    else await addSubject(payload)
    setForm(EMPTY)
    await reloadSubjects()
  }

  const edit = (s) =>
    setForm({
      id: s.id,
      name: s.name,
      teacher: s.teacher ?? '',
      lectureRoom: s.lectureRoom ?? '',
      lectureLink: s.lectureLink ?? '',
      seminarRoom: s.seminarRoom ?? '',
      seminarLink: s.seminarLink ?? '',
    })

  const remove = async (id) => {
    await removeSubject(id)
    if (form.id === id) setForm(EMPTY)
    await reloadSubjects()
  }

  // Рядок полів кабінет/посилання для однієї групи (лекція/семінар/заняття)
  const slotFields = (prefix) => (
    <>
      {showRoom && (
        <input
          type="text"
          placeholder={t('study.room')}
          value={form[`${prefix}Room`]}
          onChange={(e) => set({ [`${prefix}Room`]: e.target.value })}
        />
      )}
      {showLink && (
        <input
          type="text"
          placeholder={t('study.link')}
          value={form[`${prefix}Link`]}
          onChange={(e) => set({ [`${prefix}Link`]: e.target.value })}
        />
      )}
    </>
  )

  return (
    <div className="card">
      <form className="study-form" onSubmit={submit}>
        <input
          type="text"
          placeholder={t('study.subjectName')}
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <input
          type="text"
          placeholder={t('study.subjectTeacher')}
          value={form.teacher}
          onChange={(e) => set({ teacher: e.target.value })}
        />

        {isPupil ? (
          <div className="study-slot">{slotFields('lecture')}</div>
        ) : (
          <>
            <div className="study-slot">
              <span className="study-slot-label">{t('study.lecture')}</span>
              {slotFields('lecture')}
            </div>
            <div className="study-slot">
              <span className="study-slot-label">{t('study.seminar')}</span>
              {slotFields('seminar')}
            </div>
          </>
        )}

        <div className="study-form-actions">
          {form.id && (
            <button type="button" className="btn-ghost" onClick={() => setForm(EMPTY)}>
              {t('study.cancelEdit')}
            </button>
          )}
          <button type="submit" className="btn-accent" disabled={!canSave}>
            {form.id ? t('study.saveSubject') : t('study.addSubject')}
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
                <th>{isPupil ? t('study.col.place') : t('study.lecture')}</th>
                {!isPupil && <th>{t('study.seminar')}</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.teacher || <span className="none-text">—</span>}</td>
                  <td>{placeCell(s.lectureRoom, s.lectureLink)}</td>
                  {!isPupil && <td>{placeCell(s.seminarRoom, s.seminarLink)}</td>}
                  <td className="study-row-actions">
                    <button
                      type="button"
                      className="study-icon-btn"
                      onClick={() => edit(s)}
                      aria-label={t('planner.actionEdit')}
                      data-tooltip={t('planner.actionEdit')}
                    >
                      <Icon name="pencil" />
                    </button>
                    <button
                      type="button"
                      className="study-icon-btn study-icon-btn--danger"
                      onClick={() => remove(s.id)}
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

function placeCell(room, link) {
  const parts = [room, link].filter(Boolean)
  return parts.length ? parts.join(' · ') : <span className="none-text">—</span>
}
