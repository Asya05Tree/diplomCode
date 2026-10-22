import { useState } from 'react'
import { useI18n } from '../i18n'
import './Study.css'

// Розділ "Навчання" (мокап mockups/study-variants/variant-4 — чотири великі
// плитки-вкладки). Дані демонстраційні (поки без бекенду): предмети, викладачі,
// розклад на два тижні, дзвінки та місячний календар із завданнями й оцінкою.

// Предмет → кабінет і короткий підпис викладача (однакові в усіх клітинках розкладу).
const SUBJECT_INFO = {
  math: { name: { uk: 'Матаналіз', en: 'Calculus' }, place: { uk: 'ауд. 204', en: 'room 204' }, teacher: { uk: 'Іванов О.П.', en: 'Ivanov O.P.' } },
  prog: { name: { uk: 'Програмування', en: 'Programming' }, place: { uk: 'Zoom', en: 'Zoom' }, teacher: { uk: 'Петренко І.В.', en: 'Petrenko I.V.' } },
  db: { name: { uk: 'Бази даних', en: 'Databases' }, place: { uk: 'ауд. 205', en: 'room 205' }, teacher: { uk: 'Коваленко С.М.', en: 'Kovalenko S.M.' } },
  eng: { name: { uk: 'Англ. мова', en: 'English' }, place: { uk: 'ауд. 112', en: 'room 112' }, teacher: { uk: 'Шевченко Н.Д.', en: 'Shevchenko N.D.' } },
  phys: { name: { uk: 'Фізика', en: 'Physics' }, place: { uk: 'ауд. 301', en: 'room 301' }, teacher: { uk: 'Бондаренко А.І.', en: 'Bondarenko A.I.' } },
  hist: { name: { uk: 'Історія України', en: 'History of Ukraine' }, place: { uk: 'ауд. 110', en: 'room 110' }, teacher: { uk: 'Мельник О.Р.', en: 'Melnyk O.R.' } },
}

const TEACHERS = [
  { name: 'Іванов Олексій Петрович', subj: 'math', contact: 'o.ivanov@univ.edu' },
  { name: 'Петренко Ірина Василівна', subj: 'prog', contact: 'Telegram · @i_petrenko' },
  { name: 'Коваленко Сергій Миколайович', subj: 'db', contact: 's.kovalenko@univ.edu' },
  { name: 'Шевченко Наталія Дмитрівна', subj: 'eng', contact: 'n.shevchenko@univ.edu' },
  { name: 'Бондаренко Андрій Ігорович', subj: 'phys', contact: 'Telegram · @a_bondarenko' },
  { name: 'Мельник Ольга Романівна', subj: 'hist', contact: 'o.melnyk@univ.edu' },
]

// Розклад: 6 пар × 5 днів (Пн–Пт). Ключ предмета або null (вікно).
const SCHEDULE = {
  1: [
    ['math', 'eng', 'prog', 'phys', null],
    ['prog', 'db', 'math', 'hist', 'eng'],
    ['phys', null, 'hist', 'db', 'prog'],
    [null, 'math', null, null, 'phys'],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
  2: [
    ['db', 'math', 'eng', 'prog', 'phys'],
    ['math', 'prog', 'db', 'eng', 'hist'],
    ['hist', 'phys', null, 'math', null],
    [null, null, 'prog', null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
}

const DEFAULT_BELLS = [
  ['08:30', '09:50'],
  ['10:00', '11:20'],
  ['11:40', '13:00'],
  ['13:20', '14:40'],
  ['15:00', '16:20'],
  ['16:30', '17:50'],
]

const ASSIGNMENTS = [
  { id: 1, task: { uk: 'Лабораторна №3', en: 'Lab #3' }, subj: 'prog', deadline: '05.10.2026', day: 5, status: 'done', grade: '95/100' },
  { id: 2, task: { uk: 'ДЗ №4', en: 'HW #4' }, subj: 'math', deadline: '08.10.2026', day: 8, status: 'done', grade: '11/12' },
  { id: 3, task: { uk: 'Лабораторна №2', en: 'Lab #2' }, subj: 'db', deadline: '12.10.2026', day: 12, status: 'done', grade: '88/100' },
  { id: 4, task: { uk: 'Есе', en: 'Essay' }, subj: 'eng', deadline: '15.10.2026', day: 15, status: 'notDone', grade: null },
  { id: 5, task: { uk: 'ДЗ №5', en: 'HW #5' }, subj: 'math', deadline: '19.10.2026', day: 19, status: 'today', grade: null },
  { id: 6, task: { uk: 'Лабораторна №4', en: 'Lab #4' }, subj: 'phys', deadline: '22.10.2026', day: 22, status: 'notDone', grade: null },
  { id: 7, task: { uk: 'Реферат', en: 'Term paper' }, subj: 'hist', deadline: '27.10.2026', day: 27, status: 'notDone', grade: null },
  { id: 8, task: { uk: 'Лабораторна №3', en: 'Lab #3' }, subj: 'db', deadline: '30.10.2026', day: 30, status: 'notDone', grade: null },
]

// Жовтень 2026 починається в четвер → три приглушені дні попереднього місяця
// спереду (Пн/Вт/Ср) і один день листопада в кінці.
const LEAD_MUTED = [28, 29, 30]
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const TRAIL_MUTED = [1]
const TODAY_DAY = 19
const DEADLINE_DAYS = new Set(ASSIGNMENTS.map((a) => a.day))

const STATUS_CLASS = { done: 'badge--ok', notDone: 'badge--bad', today: 'badge--warn' }

const TABS = [
  { key: 'teachers', icon: '🧑‍🏫' },
  { key: 'schedule', icon: '🗓️' },
  { key: 'bells', icon: '⏰' },
  { key: 'month', icon: '📅' },
]

export default function Study() {
  const { t, language } = useI18n()
  const [tab, setTab] = useState('teachers')
  const [week, setWeek] = useState(1) // 1 | 2 — підвкладка розкладу
  const [bells, setBells] = useState(DEFAULT_BELLS)
  const [gradeScale, setGradeScale] = useState('school') // 'school' | 'univ'

  const weekdays = t('planner.weekdaysShort').split(',')
  const scheduleDays = weekdays.slice(0, 5)

  const subjectName = (key) => SUBJECT_INFO[key].name[language]

  const handleBell = (pairIdx, edge, value) => {
    setBells((prev) => prev.map((row, i) => (i === pairIdx ? (edge === 0 ? [value, row[1]] : [row[0], value]) : row)))
  }

  const tabMeta = {
    teachers: t('study.tab.teachersMeta', { count: TEACHERS.length }),
    schedule: t('study.tab.scheduleMeta'),
    bells: t('study.tab.bellsMeta', { count: DEFAULT_BELLS.length }),
    month: t('study.tab.monthMeta', { count: ASSIGNMENTS.length }),
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
            <span className="study-tab-icon">{item.icon}</span>
            <span className="study-tab-title">{t(`study.tab.${item.key}`)}</span>
            <span className="study-tab-meta">{tabMeta[item.key]}</span>
          </button>
        ))}
      </div>

      {tab === 'teachers' && (
        <div className="card table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('study.col.name')}</th>
                <th>{t('study.col.subject')}</th>
                <th>{t('study.col.contact')}</th>
              </tr>
            </thead>
            <tbody>
              {TEACHERS.map((teacher) => (
                <tr key={teacher.contact}>
                  <td>{teacher.name}</td>
                  <td>{subjectName(teacher.subj)}</td>
                  <td>{teacher.contact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="card">
          <div className="week-tabs-nav">
            {[1, 2].map((w) => (
              <button
                key={w}
                type="button"
                className={week === w ? 'pill pill--active' : 'pill'}
                onClick={() => setWeek(w)}
              >
                {t('study.week', { n: w })}
              </button>
            ))}
          </div>

          <div className="table-scroll" style={{ marginTop: 14 }}>
            <table className="data-table schedule-table">
              <thead>
                <tr>
                  <th>{t('study.col.pair')}</th>
                  {scheduleDays.map((d) => (
                    <th key={d}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCHEDULE[week].map((row, pairIdx) => (
                  <tr key={pairIdx}>
                    <td>{pairIdx + 1}</td>
                    {row.map((key, dayIdx) => (
                      <td key={dayIdx}>
                        {key ? (
                          <span className="schedule-cell">
                            <strong>{subjectName(key)}</strong>
                            <span>
                              {SUBJECT_INFO[key].place[language]} · {SUBJECT_INFO[key].teacher[language]}
                            </span>
                          </span>
                        ) : (
                          <span className="none-text">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'bells' && (
        <div className="card table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('study.col.pair')}</th>
                <th>{t('study.col.start')}</th>
                <th>{t('study.col.end')}</th>
              </tr>
            </thead>
            <tbody>
              {bells.map((row, pairIdx) => (
                <tr key={pairIdx}>
                  <td>{pairIdx + 1}</td>
                  <td>
                    <input
                      type="time"
                      className="time-field"
                      value={row[0]}
                      onChange={(e) => handleBell(pairIdx, 0, e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      className="time-field"
                      value={row[1]}
                      onChange={(e) => handleBell(pairIdx, 1, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'month' && (
        <div className="card">
          <div className="month-nav">
            <button type="button" className="month-nav-btn" aria-label="prev">◀</button>
            <span className="month-nav-label">{t('study.monthLabel')}</span>
            <button type="button" className="month-nav-btn" aria-label="next">▶</button>
          </div>

          <div className="month-grid">
            {weekdays.map((d) => (
              <div key={d} className="month-weekday">{d}</div>
            ))}
            {LEAD_MUTED.map((d) => (
              <div key={`lead-${d}`} className="month-day month-day--muted">{d}</div>
            ))}
            {MONTH_DAYS.map((d) => (
              <div
                key={d}
                className={`month-day${d === TODAY_DAY ? ' month-day--today' : ''}`}
              >
                {d}
                {DEADLINE_DAYS.has(d) && <span className="month-day-dot" />}
              </div>
            ))}
            {TRAIL_MUTED.map((d) => (
              <div key={`trail-${d}`} className="month-day month-day--muted">{d}</div>
            ))}
          </div>

          <div className="table-scroll" style={{ marginTop: 18 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('study.col.task')}</th>
                  <th>{t('study.col.subject')}</th>
                  <th>{t('study.col.deadline')}</th>
                  <th>{t('study.col.status')}</th>
                  <th>{t('study.col.grade')}</th>
                </tr>
              </thead>
              <tbody>
                {ASSIGNMENTS.map((a) => (
                  <tr key={a.id}>
                    <td>{a.task[language]}</td>
                    <td>{subjectName(a.subj)}</td>
                    <td>{a.deadline}</td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[a.status]}`}>
                        {t(`study.status.${a.status}`)}
                      </span>
                    </td>
                    <td>{a.grade ?? <span className="none-text">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grade-block">
            <div className="grade-head">
              <h4>{t('study.gradeTitle')}</h4>
              <div className="grade-switch">
                <button
                  type="button"
                  className={gradeScale === 'school' ? 'pill pill--active' : 'pill'}
                  onClick={() => setGradeScale('school')}
                >
                  {t('study.gradeSchool')}
                </button>
                <button
                  type="button"
                  className={gradeScale === 'univ' ? 'pill pill--active' : 'pill'}
                  onClick={() => setGradeScale('univ')}
                >
                  {t('study.gradeUniv')}
                </button>
              </div>
            </div>
            <div className="grade-value-panel">
              <span className="study-grade-value">{gradeScale === 'school' ? '10' : '87'}</span>
              <span className="placeholder-text">
                {gradeScale === 'school' ? t('study.gradeSchoolHint') : t('study.gradeUnivHint')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
