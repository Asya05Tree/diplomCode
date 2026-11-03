import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import { getStudySettings, setStudySettings, getSubjects, getBells } from '../api/study'
import { LEARNING_FORMS } from '../components/study/studyShared'
import SubjectsTab from '../components/study/SubjectsTab'
import AssignmentsTab from '../components/study/AssignmentsTab'
import BellsTab from '../components/study/BellsTab'
import ScheduleTab from '../components/study/ScheduleTab'
import ExtraTab from '../components/study/ExtraTab'
import ProjectsTab from '../components/study/ProjectsTab'
import './Study.css'

// Розділ "Навчання". Враховує тип користувача (школяр/студент) і форму навчання (дистанційне/очне/
// змішане, верхній перемикач). Школяр має єдине "заняття" й домашку; студент — поділ лекція/семінар,
// завдання з оцінками 0–100 і великі роботи (диплом/курсова/практика). Розклад і консультації
// створюють правила повторення (moduleCode="study"), тому також з'являються у спільному календарі.

export default function Study() {
  const { t } = useI18n()
  const { studentType } = useOutletContext()
  const isPupil = studentType === 'pupil'
  const isStudent = studentType === 'student'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('subjects')

  const [settings, setSettings] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [bells, setBells] = useState([]) // "HH:MM" у startTime/endTime

  const reloadSubjects = async () => setSubjects(await getSubjects())
  const reloadSettings = async () => setSettings(await getStudySettings())

  useEffect(() => {
    let cancelled = false
    Promise.all([getStudySettings(), getSubjects(), getBells()])
      .then(([st, subs, bl]) => {
        if (cancelled) return
        setSettings(st)
        setSubjects(subs)
        setBells(bl.map((b) => ({ startTime: b.startTime.slice(0, 5), endTime: b.endTime.slice(0, 5) })))
        setLoading(false)
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

  // Верхній перемикач форми навчання пише в налаштування
  const handleSetForm = async (form) => {
    const next = { ...settings, learningForm: form }
    setSettings(next)
    await setStudySettings(next)
  }

  // Якщо тип не школяр/студент — розділ недоступний (sidebar його ховає; це запасний екран)
  if (studentType !== 'pupil' && studentType !== 'student') {
    return (
      <div className="study-page">
        <div className="page-head"><h2>{t('nav.study')}</h2></div>
        <p className="placeholder-text">{t('study.noStatus')}</p>
      </div>
    )
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

  const tabs = [
    { key: 'subjects', icon: 'user' },
    { key: 'schedule', icon: 'calendar-days' },
    { key: 'bells', icon: 'bell' },
    { key: 'assignments', icon: 'clipboard' },
    { key: 'extra', icon: 'board' },
    ...(isStudent ? [{ key: 'projects', icon: 'notes' }] : []),
  ]

  const learningForm = settings?.learningForm ?? 'distance'

  return (
    <div className="study-page">
      <div className="page-head">
        <h2>{t('nav.study')}</h2>
      </div>

      {/* Верхній перемикач форми навчання — керує полями предметів/розкладу */}
      <div className="study-form-switch">
        <span className="study-form-switch-label">{t('study.learningForm')}</span>
        <div className="study-seg">
          {LEARNING_FORMS.map((form) => (
            <button
              key={form}
              type="button"
              className={learningForm === form ? 'study-seg-btn study-seg-btn--active' : 'study-seg-btn'}
              onClick={() => handleSetForm(form)}
            >
              {t(`study.form.${form}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="study-tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'study-tab study-tab--active' : 'study-tab'}
            onClick={() => setTab(item.key)}
          >
            <span className="study-tab-icon"><Icon name={item.icon} /></span>
            <span className="study-tab-title">{t(`study.tab.${item.key}`)}</span>
          </button>
        ))}
      </div>

      {tab === 'subjects' && (
        <SubjectsTab subjects={subjects} reloadSubjects={reloadSubjects} learningForm={learningForm} isPupil={isPupil} />
      )}
      {tab === 'schedule' && (
        <ScheduleTab
          subjects={subjects}
          bells={bells}
          settings={settings}
          reloadSettings={reloadSettings}
          learningForm={learningForm}
          isPupil={isPupil}
        />
      )}
      {tab === 'bells' && <BellsTab bells={bells} setBells={setBells} isPupil={isPupil} />}
      {tab === 'assignments' && <AssignmentsTab subjects={subjects} isPupil={isPupil} />}
      {tab === 'extra' && <ExtraTab subjects={subjects} learningForm={learningForm} />}
      {tab === 'projects' && isStudent && <ProjectsTab />}
    </div>
  )
}
