import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import {
  getCabinet,
  searchMedicines,
  searchTags,
  addMedicine,
  setMedicineState as apiSetMedicineState,
  getInteractions,
  getConditions,
  addCondition as apiAddCondition,
  removeCondition as apiRemoveCondition,
  medName,
  medSubstance,
  formName,
  conditionName,
} from '../api/medicineCabinet'
import { getHealthProfile, setHealthProfile } from '../api/healthProfile'
import { getVisits, addVisit, removeVisit } from '../api/checkup'
import { RANGES, MAX_LEN, clampNumber, filterWords, limitText } from '../utils/validation'
import { todayApiDate } from '../utils/date'
import './Health.css'

const STOCK_TOGGLE = [
  { state: 'Available', cls: 'ok' },
  { state: 'RunningLow', cls: 'warn' },
  { state: 'OutOfStock', cls: 'bad' },
]

// Сталий перелік лікарів для чекапу — сімейний лікар завжди зверху (вимога).
const CHECKUP_DOCTORS = [
  'family', 'therapist', 'pediatrician', 'dentist', 'ophthalmologist', 'otolaryngologist',
  'cardiologist', 'dermatologist', 'neurologist', 'gastroenterologist', 'endocrinologist',
  'surgeon', 'gynecologist', 'urologist', 'psychotherapist', 'orthopedist',
]

// Модуль "Здоровʼя" (planner-spec.md §3.5 аптечка, §3.1/§11 хронічні захворювання).
// Дві вкладки: Аптечка (ліки користувача зі стану + взаємодії речовин із довідника DDInter) та
// Хронічні захворювання, де хвороба, що впливає на їжу, стає правилом на тег і фільтрує страви.
// Дані — з бекенда (/api/medicine-cabinet, /api/health-profile).
export default function Health() {
  const { t, language, formatDate, formatClock } = useI18n()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [tab, setTab] = useState('meds') // 'meds' | 'cond'
  const [medicines, setMedicines] = useState([]) // аптечка користувача
  const [interactions, setInteractions] = useState({}) // medicineId -> [{otherMedicineName.., level, mechanism}]
  const [conditions, setConditions] = useState([])
  const [profile, setProfile] = useState(null)

  const [form, setForm] = useState('all') // фільтр за формою випуску
  const [addMedOpen, setAddMedOpen] = useState(false)
  const [medSearch, setMedSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])

  // Редаговані параметри людини — локальні рядки, синхронізуються з профілем на blur
  const currentYear = new Date().getFullYear()
  const [weightInput, setWeightInput] = useState('')
  const [heightInput, setHeightInput] = useState('')
  const [ageInput, setAgeInput] = useState('')

  const [condForm, setCondForm] = useState({ open: false, name: '', affectsFood: false, tag: '', tagKey: '', relation: 'Avoid' })
  const [tagSuggestions, setTagSuggestions] = useState([])
  const [tagNotice, setTagNotice] = useState('') // текст тега, якого немає серед тегів продуктів

  // Чекап: заплановані візити до лікарів (створюють події в календарі). Форма відкривається під лікарем.
  const [visits, setVisits] = useState([])
  const [schedKey, setSchedKey] = useState('') // ключ лікаря, для якого зараз відкрита форма
  const [schedForm, setSchedForm] = useState({ date: todayApiDate(), time: '09:00', place: '', note: '' })

  useEffect(() => {
    getVisits().then((data) => setVisits(data ?? [])).catch(() => setVisits([]))
  }, [])

  const openSchedule = (key) => {
    setSchedKey(key)
    setSchedForm({ date: todayApiDate(), time: '09:00', place: '', note: '' })
  }

  const submitVisit = async () => {
    if (!schedKey || !schedForm.date) return
    const when = `${schedForm.date}T${schedForm.time || '09:00'}:00`
    await addVisit({
      doctorKey: schedKey,
      doctorName: t(`checkup.doctor.${schedKey}`),
      when,
      place: schedForm.place.trim() || null,
      note: schedForm.note.trim() || null,
    })
    setVisits(await getVisits())
    setSchedKey('')
  }

  const cancelVisit = async (id) => {
    await removeVisit(id)
    setVisits((prev) => prev.filter((v) => v.id !== id))
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([getCabinet(), getConditions(), getHealthProfile().catch(() => null)])
      .then(async ([meds, conds, prof]) => {
        if (cancelled) return
        setMedicines(meds)
        setConditions(conds)
        setProfile(prof)
        // Взаємодії тягнемо для кожних ліків аптечки (пари, де друга речовина теж у користувача).
        const entries = await Promise.all(
          meds.map((m) =>
            getInteractions(m.medicineId)
              .then((list) => [m.medicineId, list])
              .catch(() => [m.medicineId, []]),
          ),
        )
        if (cancelled) return
        setInteractions(Object.fromEntries(entries))
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

  // Коли профіль завантажився — заповнюємо поля введення (вік рахуємо з року народження)
  useEffect(() => {
    setWeightInput(profile?.weight != null ? String(profile.weight) : '')
    setHeightInput(profile?.height != null ? String(profile.height) : '')
    setAgeInput(profile?.birthYear != null ? String(currentYear - profile.birthYear) : '')
  }, [profile, currentYear])

  // Зберегти параметри людини: клампимо у реалістичні межі (і показуємо назад), вік → рік народження.
  const saveProfile = async () => {
    const empty = (s) => s.trim() === ''
    let weight = empty(weightInput) ? null : clampNumber(weightInput, RANGES.weight.min, RANGES.weight.max)
    let height = empty(heightInput) ? null : clampNumber(heightInput, RANGES.height.min, RANGES.height.max)
    let age = empty(ageInput) ? null : Math.round(clampNumber(ageInput, RANGES.age.min, RANGES.age.max))
    if (weight != null) setWeightInput(String(weight))
    if (height != null) setHeightInput(String(height))
    if (age != null) setAgeInput(String(age))
    const birthYear = age != null ? currentYear - age : null
    const payload = { weight, height, birthYear, gender: profile?.gender ?? null }
    setProfile((p) => ({ ...(p || {}), ...payload }))
    await setHealthProfile(payload).catch(() => {})
  }

  const lowCount = medicines.filter((m) => m.state === 'RunningLow').length
  const foodConditions = conditions.filter((c) => c.affectsFood)

  // Форми, наявні в аптечці користувача — для фільтр-пілюль (замість старих "категорій").
  const forms = useMemo(() => {
    const seen = new Map()
    for (const m of medicines) if (!seen.has(m.formKey)) seen.set(m.formKey, m)
    return [...seen.values()]
  }, [medicines])

  const visibleMeds = useMemo(
    () => (form === 'all' ? medicines : medicines.filter((m) => m.formKey === form)),
    [medicines, form],
  )

  const reloadCabinet = async () => {
    const meds = await getCabinet()
    setMedicines(meds)
    const entries = await Promise.all(
      meds.map((m) =>
        getInteractions(m.medicineId)
          .then((list) => [m.medicineId, list])
          .catch(() => [m.medicineId, []]),
      ),
    )
    setInteractions(Object.fromEntries(entries))
  }

  const handleMedState = async (m, state) => {
    setMedicines((prev) => prev.map((x) => (x.medicineId === m.medicineId ? { ...x, state } : x)))
    await apiSetMedicineState(m.medicineId, state, m.expiresAt)
  }

  const handleMedSearch = (q) => {
    setMedSearch(q)
    const query = q.trim()
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    searchMedicines(query).then(setSearchResults).catch(() => setSearchResults([]))
  }

  const handleAddMed = async (id) => {
    await addMedicine(id)
    await reloadCabinet()
    // Прибрати щойно додані з результатів пошуку (сервер і так виключає доданих при наступному запиті).
    setSearchResults((prev) => prev.filter((m) => m.id !== id))
  }

  const resetCondForm = () => {
    setCondForm({ open: false, name: '', affectsFood: false, tag: '', tagKey: '', relation: 'Avoid' })
    setTagSuggestions([])
  }

  // Пошук тега по тегах продуктів (запасах), поки користувач вводить (укр. або англ.).
  // Поки це вільний текст — канонічний ключ скидаємо (проставиться, коли оберуть підказку).
  const handleTagSearch = (q) => {
    // Тег — назва алергену/продукту: лише укр/англ літери (щоб збігався з тегами продуктів)
    const clean = filterWords(q, 40)
    setCondForm((f) => ({ ...f, tag: clean, tagKey: '' }))
    const query = clean.trim()
    if (query.length < 2) {
      setTagSuggestions([])
      return
    }
    searchTags(query).then(setTagSuggestions).catch(() => setTagSuggestions([]))
  }

  // Обрали підказку: у полі показуємо назву мовою інтерфейсу, але зберігаємо канонічний ключ (англ.)
  const pickTag = (s) => {
    setCondForm((f) => ({ ...f, tag: language === 'en' ? s.key : s.displayName, tagKey: s.key }))
    setTagSuggestions([])
  }

  const handleAddCondition = async () => {
    if (!condForm.name.trim()) return
    const tagText = condForm.tag.trim()
    const affectsFood = condForm.affectsFood
    const created = await apiAddCondition({
      nameUk: condForm.name.trim(),
      affectsFood,
      // Якщо обрано підказку — шлемо канонічний ключ; інакше вільний текст (сервер зіставить за укр/англ назвою)
      tag: condForm.tagKey || condForm.tag,
      relation: condForm.relation,
    })
    setConditions(await getConditions())
    // Невідомий тег (немає серед тегів продуктів) — зберегли, але попереджаємо користувача
    setTagNotice(affectsFood && tagText && created && created.tagKnown === false ? tagText : '')
    resetCondForm()
  }

  const handleRemoveCondition = async (id) => {
    await apiRemoveCondition(id)
    setConditions(await getConditions())
  }

  if (loading) {
    return (
      <div className="health-page">
        <p className="placeholder-text">{t('common.loading')}</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="health-page">
        <p className="placeholder-text">{t('common.error')}</p>
      </div>
    )
  }

  return (
    <div className="health-page">
      <div className="page-head">
        <h2>{t('nav.health')}</h2>
      </div>

      {/* Параметри людини редагуються прямо тут: поле не видно, лише стилізоване число + одиниця */}
      <div className="profile-kv">
        <label className="profile-field">
          <span className="profile-field-label">{t('health.profile.weight')}</span>
          <span className="profile-field-edit">
            <input
              type="number"
              className="profile-field-input"
              inputMode="decimal"
              min={RANGES.weight.min}
              max={RANGES.weight.max}
              step="0.1"
              placeholder="—"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onBlur={saveProfile}
            />
            <span className="profile-field-unit">{t('health.unit.kg')}</span>
          </span>
        </label>
        <label className="profile-field">
          <span className="profile-field-label">{t('health.profile.age')}</span>
          <span className="profile-field-edit">
            <input
              type="number"
              className="profile-field-input"
              inputMode="numeric"
              min={RANGES.age.min}
              max={RANGES.age.max}
              step="1"
              placeholder="—"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              onBlur={saveProfile}
            />
            <span className="profile-field-unit">{t('health.unit.years')}</span>
          </span>
        </label>
        <label className="profile-field">
          <span className="profile-field-label">{t('health.profile.height')}</span>
          <span className="profile-field-edit">
            <input
              type="number"
              className="profile-field-input"
              inputMode="decimal"
              min={RANGES.height.min}
              max={RANGES.height.max}
              step="0.1"
              placeholder="—"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              onBlur={saveProfile}
            />
            <span className="profile-field-unit">{t('health.unit.cm')}</span>
          </span>
        </label>
      </div>

      <div className="health-tabs">
        <button
          type="button"
          className={tab === 'meds' ? 'health-tab health-tab--active' : 'health-tab'}
          onClick={() => setTab('meds')}
        >
          <span className="health-tab-icon"><Icon name="beaker" /></span>
          <span className="health-tab-title">{t('health.tab.meds')}</span>
          <span className="health-tab-meta">
            {t('health.tab.medsMeta', { count: medicines.length, low: lowCount })}
          </span>
        </button>
        <button
          type="button"
          className={tab === 'cond' ? 'health-tab health-tab--active' : 'health-tab'}
          onClick={() => setTab('cond')}
        >
          <span className="health-tab-icon"><Icon name="clipboard" /></span>
          <span className="health-tab-title">{t('health.tab.cond')}</span>
          <span className="health-tab-meta">
            {t('health.tab.condMeta', { count: conditions.length, food: foodConditions.length })}
          </span>
        </button>
        <button
          type="button"
          className={tab === 'checkup' ? 'health-tab health-tab--active' : 'health-tab'}
          onClick={() => setTab('checkup')}
        >
          <span className="health-tab-icon"><Icon name="clipboard" /></span>
          <span className="health-tab-title">{t('health.tab.checkup')}</span>
          <span className="health-tab-meta">{t('health.tab.checkupMeta', { count: visits.length })}</span>
        </button>
      </div>

      {tab === 'meds' ? (
        <div className="card">
          <div className="section-title">
            <h3>{t('health.tab.meds')}</h3>
            <button type="button" className="btn-accent" onClick={() => setAddMedOpen((v) => !v)}>
              {t('health.addMed')}
            </button>
          </div>

          {/* Рядок пошуку над аптечкою: стилізований, як решта полів; макс. 5 видимих варіантів зі скролом */}
          {addMedOpen && (
            <div className="med-search">
              <div className="med-search-field">
                <Icon name="search" className="med-search-icon" />
                <input
                  type="text"
                  placeholder={t('health.searchMed')}
                  value={medSearch}
                  onChange={(e) => handleMedSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <ul className="med-search-results">
                {searchResults.map((m) => (
                  <li key={m.id}>
                    <span>
                      {medName(m, language)}
                      {(m.substanceUk || m.substanceEn) && (
                        <span className="drawer-sub"> · {medSubstance(m, language)}</span>
                      )}
                    </span>
                    <button type="button" className="pill" onClick={() => handleAddMed(m.id)}>
                      {t('health.add')}
                    </button>
                  </li>
                ))}
                {medSearch.trim().length < 2 && <li className="none-text">{t('health.searchHint')}</li>}
                {medSearch.trim().length >= 2 && searchResults.length === 0 && (
                  <li className="none-text">{t('health.addMedEmpty')}</li>
                )}
              </ul>
            </div>
          )}

          {medicines.length === 0 ? (
            <p className="placeholder-text">{t('health.cabinetEmpty')}</p>
          ) : (
            <>
              <div className="health-pills">
                <button
                  type="button"
                  className={form === 'all' ? 'pill pill--active' : 'pill'}
                  onClick={() => setForm('all')}
                >
                  {t('health.filterAll')}
                </button>
                {forms.map((m) => (
                  <button
                    key={m.formKey}
                    type="button"
                    className={form === m.formKey ? 'pill pill--active' : 'pill'}
                    onClick={() => setForm(m.formKey)}
                  >
                    {formName(m, language)}
                  </button>
                ))}
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('health.col.name')}</th>
                      <th>{t('health.col.category')}</th>
                      <th>{t('health.col.substance')}</th>
                      <th>{t('health.col.state')}</th>
                      <th>{t('health.col.conflicts')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMeds.map((m) => {
                      const inter = interactions[m.medicineId] || []
                      const substance = medSubstance(m, language)
                      const hasSubstance = !!(m.substanceUk || m.substanceEn)
                      return (
                        <tr key={m.medicineId}>
                          <td>{medName(m, language)}</td>
                          <td>
                            <span className="category-badge">{formName(m, language)}</span>
                          </td>
                          <td>{substance || <span className="none-text">—</span>}</td>
                          <td>
                            <div className="stock-toggle">
                              {STOCK_TOGGLE.map(({ state: s, cls }) => (
                                <button
                                  key={s}
                                  type="button"
                                  title={t(`food.state.${s}`)}
                                  className={`stock-circle stock-circle--${cls}${m.state === s ? ' stock-circle--on' : ''}`}
                                  onClick={() => handleMedState(m, s)}
                                />
                              ))}
                            </div>
                          </td>
                          <td>
                            {inter.length > 0 ? (
                              <div className="conflict-tags">
                                {inter.map((it, i) => (
                                  <span
                                    key={i}
                                    className={`conflict-tag conflict-tag--${(it.level || 'unknown').toLowerCase()}`}
                                    title={it.mechanism || ''}
                                  >
                                    {language === 'en' ? it.otherMedicineNameEn : it.otherMedicineNameUk}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="none-text">
                                {hasSubstance ? t('health.noConflicts') : t('health.notSubstance')}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="health-disclaimer">{t('health.interactionsDisclaimer')}</p>
            </>
          )}
        </div>
      ) : tab === 'cond' ? (
        <div className="card">
          <div className="section-title">
            <h3 className="health-cond-title">{t('health.tab.cond')}</h3>
            {!condForm.open && (
              <button type="button" className="btn-accent" onClick={() => setCondForm((f) => ({ ...f, open: true }))}>
                {t('health.addCond')}
              </button>
            )}
          </div>
          <p className="placeholder-text">{t('health.condHint')}</p>

          {tagNotice && (
            <div className="tag-unknown-notice">
              <Icon name="warning" />
              <span>{t('health.tagUnknownNotice', { tag: tagNotice })}</span>
              <button
                type="button"
                className="tag-unknown-dismiss"
                onClick={() => setTagNotice('')}
                aria-label={t('common.delete')}
              >
                <Icon name="close" />
              </button>
            </div>
          )}

          {condForm.open && (
            <div className="cond-add-form">
              <input
                type="text"
                className="cond-add-name"
                placeholder={t('health.addCondName')}
                value={condForm.name}
                maxLength={MAX_LEN.name}
                onChange={(e) => setCondForm((f) => ({ ...f, name: limitText(e.target.value, MAX_LEN.name) }))}
              />
              <label className="switch-wrap cond-add-switch">
                <span className="switch-label">{t('health.affectsFood')}</span>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={condForm.affectsFood}
                    onChange={(e) => setCondForm((f) => ({ ...f, affectsFood: e.target.checked }))}
                  />
                  <span className="switch-track" />
                </span>
              </label>
              {condForm.affectsFood && (
                <div className="cond-add-food">
                  <div className="cond-tag-field">
                    <input
                      type="text"
                      className="cond-add-tag"
                      placeholder={t('health.condTagPlaceholder')}
                      value={condForm.tag}
                      onChange={(e) => handleTagSearch(e.target.value)}
                    />
                    {tagSuggestions.length > 0 && (
                      <ul className="cond-tag-suggestions">
                        {tagSuggestions.map((s) => (
                          <li key={s.key}>
                            <button type="button" onClick={() => pickTag(s)}>
                              <span className="cond-tag-suggestion-key">
                                {language === 'en' ? s.key : s.displayName}
                              </span>
                              <span className="cond-tag-suggestion-name">
                                {language === 'en' ? s.displayName : s.key}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <select
                    className="rule-select"
                    value={condForm.relation}
                    onChange={(e) => setCondForm((f) => ({ ...f, relation: e.target.value }))}
                  >
                    <option value="Avoid">{t('health.rule.avoid')}</option>
                    <option value="Forbidden">{t('health.rule.forbidden')}</option>
                  </select>
                  <span className="cond-add-hint">{t('health.condTagLabel')}</span>
                </div>
              )}
              <div className="cond-add-actions">
                <button type="button" className="btn-ghost" onClick={resetCondForm}>
                  {t('health.condCancel')}
                </button>
                <button
                  type="button"
                  className="btn-accent"
                  onClick={handleAddCondition}
                  disabled={!condForm.name.trim()}
                >
                  {t('health.condSave')}
                </button>
              </div>
            </div>
          )}

          <ul className="condition-list">
            {conditions.map((condition) => (
              <li key={condition.id} className="condition-row">
                <span className="condition-name">{conditionName(condition, language)}</span>
                {condition.affectsFood ? (
                  <>
                    <span className="condition-tag">
                      {language === 'en' ? condition.tagKey : condition.tagNameUk || condition.tagKey}
                    </span>
                    {!condition.tagKnown && (
                      <span className="tag-unknown-badge">{t('health.tagUnknownBadge')}</span>
                    )}
                    <span className={`rule-badge rule-badge--${condition.relation === 'Forbidden' ? 'bad' : 'warn'}`}>
                      {condition.relation === 'Forbidden' ? t('health.rule.forbidden') : t('health.rule.avoid')}
                    </span>
                  </>
                ) : (
                  <span className="none-text">{t('health.affectsNo')}</span>
                )}
                <button
                  type="button"
                  className="cond-remove"
                  onClick={() => handleRemoveCondition(condition.id)}
                  aria-label={t('common.delete')}
                  data-tooltip={t('common.delete')}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="card">
          <div className="section-title">
            <h3>{t('health.tab.checkup')}</h3>
          </div>
          <p className="placeholder-text">{t('checkup.hint')}</p>

          <ul className="checkup-list">
            {CHECKUP_DOCTORS.map((key) => {
              const docVisits = visits
                .filter((v) => v.doctorKey === key)
                .sort((a, b) => (a.when < b.when ? -1 : 1))
              return (
                <li key={key} className={key === 'family' ? 'checkup-row checkup-row--primary' : 'checkup-row'}>
                  <div className="checkup-main">
                    <span className="checkup-doctor">
                      <Icon name={key === 'family' ? 'health' : 'user'} className="checkup-doctor-icon" />
                      {t(`checkup.doctor.${key}`)}
                      {key === 'family' && <span className="checkup-primary-badge">{t('checkup.primary')}</span>}
                    </span>
                    {docVisits.length > 0 && (
                      <div className="checkup-visits">
                        {docVisits.map((v) => (
                          <span key={v.id} className="checkup-visit">
                            <Icon name="calendar" />
                            {formatDate(v.when.slice(0, 10))} · {formatClock(v.when.slice(11, 16))}
                            {v.place ? ` · ${v.place}` : ''}
                            <button
                              type="button"
                              className="checkup-visit-cancel"
                              onClick={() => cancelVisit(v.id)}
                              aria-label={t('common.delete')}
                            >
                              <Icon name="close" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" className="checkup-plan-btn" onClick={() => openSchedule(key)}>
                    <Icon name="plus" /> {t('checkup.plan')}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {schedKey && (
        <div className="checkup-modal-backdrop" onClick={() => setSchedKey('')}>
          <div className="checkup-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('checkup.planFor', { doctor: t(`checkup.doctor.${schedKey}`) })}</h3>
            <div className="checkup-form">
              <label>
                {t('checkup.date')}
                <input type="date" value={schedForm.date} onChange={(e) => setSchedForm({ ...schedForm, date: e.target.value })} />
              </label>
              <label>
                {t('checkup.time')}
                <input type="time" value={schedForm.time} onChange={(e) => setSchedForm({ ...schedForm, time: e.target.value })} />
              </label>
              <label className="checkup-form-wide">
                {t('checkup.place')}
                <input
                  type="text"
                  value={schedForm.place}
                  placeholder={t('checkup.placePlaceholder')}
                  maxLength={MAX_LEN.description}
                  onChange={(e) => setSchedForm({ ...schedForm, place: e.target.value })}
                />
              </label>
              <label className="checkup-form-wide">
                {t('checkup.note')}
                <input
                  type="text"
                  value={schedForm.note}
                  maxLength={MAX_LEN.description}
                  onChange={(e) => setSchedForm({ ...schedForm, note: e.target.value })}
                />
              </label>
            </div>
            <div className="checkup-modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setSchedKey('')}>{t('common.cancel')}</button>
              <button type="button" className="btn-accent" onClick={submitVisit}>{t('checkup.save')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
