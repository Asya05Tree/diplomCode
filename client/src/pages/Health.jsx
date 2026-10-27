import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import {
  getCabinet,
  searchMedicines,
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
import { getHealthProfile } from '../api/healthProfile'
import './Health.css'

const STOCK_TOGGLE = [
  { state: 'Available', cls: 'ok' },
  { state: 'RunningLow', cls: 'warn' },
  { state: 'OutOfStock', cls: 'bad' },
]

// Модуль "Здоровʼя" (planner-spec.md §3.5 аптечка, §3.1/§11 хронічні захворювання).
// Дві вкладки: Аптечка (ліки користувача зі стану + взаємодії речовин із довідника DDInter) та
// Хронічні захворювання, де хвороба, що впливає на їжу, стає правилом на тег і фільтрує страви.
// Дані — з бекенда (/api/medicine-cabinet, /api/health-profile).
export default function Health() {
  const { t, language } = useI18n()

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

  const [condForm, setCondForm] = useState({ open: false, name: '', affectsFood: false, tag: '', relation: 'Avoid' })

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

  const resetCondForm = () => setCondForm({ open: false, name: '', affectsFood: false, tag: '', relation: 'Avoid' })

  const handleAddCondition = async () => {
    if (!condForm.name.trim()) return
    await apiAddCondition({
      nameUk: condForm.name.trim(),
      affectsFood: condForm.affectsFood,
      tag: condForm.tag,
      relation: condForm.relation,
    })
    setConditions(await getConditions())
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

  const age = profile?.birthYear ? new Date().getFullYear() - profile.birthYear : null

  return (
    <div className="health-page">
      <div className="page-head">
        <h2>{t('nav.health')}</h2>
        <span className="variant-note">{t('health.note')}</span>
      </div>

      <div className="profile-kv">
        <div className="profile-field">
          <span className="profile-field-label">{t('health.profile.weight')}</span>
          <span className="profile-field-value">
            {profile?.weight != null ? `${profile.weight} ${t('health.unit.kg')}` : '—'}
          </span>
        </div>
        <div className="profile-field">
          <span className="profile-field-label">{t('health.profile.age')}</span>
          <span className="profile-field-value">{age != null ? `${age} ${t('health.unit.years')}` : '—'}</span>
        </div>
        <div className="profile-field">
          <span className="profile-field-label">{t('health.profile.height')}</span>
          <span className="profile-field-value">
            {profile?.height != null ? `${profile.height} ${t('health.unit.cm')}` : '—'}
          </span>
        </div>
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
      </div>

      {tab === 'meds' ? (
        <div className="card">
          <div className="section-title">
            <h3>{t('health.tab.meds')}</h3>
            <button type="button" className="btn-accent" onClick={() => setAddMedOpen(true)}>
              {t('health.addMed')}
            </button>
          </div>

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
      ) : (
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

          {condForm.open && (
            <div className="cond-add-form">
              <input
                type="text"
                className="cond-add-name"
                placeholder={t('health.addCondName')}
                value={condForm.name}
                onChange={(e) => setCondForm((f) => ({ ...f, name: e.target.value }))}
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
                  <input
                    type="text"
                    className="cond-add-tag"
                    placeholder={t('health.condTagPlaceholder')}
                    value={condForm.tag}
                    onChange={(e) => setCondForm((f) => ({ ...f, tag: e.target.value }))}
                  />
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
                    <span className="condition-tag">{condition.tagKey}</span>
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
      )}

      {addMedOpen && (
        <div className="drawer-overlay drawer-overlay--open">
          <div className="drawer-backdrop" onClick={() => setAddMedOpen(false)} />
          <aside className="drawer-panel">
            <div className="drawer-head">
              <h3>{t('health.addMedTitle')}</h3>
              <button
                type="button"
                className="drawer-close"
                onClick={() => setAddMedOpen(false)}
                aria-label="Закрити"
                data-tooltip="Закрити"
              >
                <Icon name="close" />
              </button>
            </div>
            <input
              type="text"
              className="drawer-search"
              placeholder={t('health.searchMed')}
              value={medSearch}
              onChange={(e) => handleMedSearch(e.target.value)}
            />
            <ul className="drawer-product-list">
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
          </aside>
        </div>
      )}
    </div>
  )
}
