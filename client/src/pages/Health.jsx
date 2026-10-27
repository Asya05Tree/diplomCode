import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import {
  MEDICINE_CATEGORIES,
  addCondition,
  addMedicine,
  categoryName,
  conditionName,
  conditionTag,
  getRules,
  listAddableMedicines,
  listConditions,
  listMedicines,
  medConflicts,
  medName,
  medSubstance,
  setMedicineState,
  setRule,
} from '../pseudo-db'
import './Health.css'

const STOCK_TOGGLE = [
  { state: 'Available', cls: 'ok' },
  { state: 'RunningLow', cls: 'warn' },
  { state: 'OutOfStock', cls: 'bad' },
]

// Модуль "Здоровʼя" (planner-spec.md §3.5 аптечка, §3.1/§11 хронічні захворювання).
// Дві вкладки: Аптечка (ліки, стан, конфлікти речовин — §4.7) та Хронічні захворювання,
// де хвороба, що впливає на їжу, записується правилом на тег (Forbidden/Avoid) і далі
// впливає на фільтрацію страв та запасів у модулі "Їжа". Дані — з псевдо-БД.
export default function Health() {
  const { t, language } = useI18n()

  const [tab, setTab] = useState('meds') // 'meds' | 'cond'
  const [medicines, setMedicines] = useState(() => listMedicines())
  const [addable, setAddable] = useState(() => listAddableMedicines())
  const [rules, setRules] = useState(() => getRules())
  const [category, setCategory] = useState('all')
  const [addMedOpen, setAddMedOpen] = useState(false)
  const [medSearch, setMedSearch] = useState('')
  // Хронічні захворювання: базові + додані користувачем. Форма додавання — з перемикачем
  // "впливає на їжу"; коли увімкнено, зʼявляється поле тега-обмеження + рівень (не можна/небажано).
  const [conditions, setConditions] = useState(() => listConditions())
  const [condForm, setCondForm] = useState({ open: false, name: '', affectsFood: false, tag: '', relation: 'Avoid' })

  const lowCount = medicines.filter((m) => m.state === 'RunningLow').length
  const foodConditions = conditions.filter((c) => c.affectsFood)

  const visibleMeds = useMemo(
    () => (category === 'all' ? medicines : medicines.filter((m) => m.category === category)),
    [medicines, category],
  )

  const handleMedState = (id, state) => {
    setMedicineState(id, state)
    setMedicines(listMedicines())
  }

  const handleAddMed = (id) => {
    addMedicine(id)
    setMedicines(listMedicines())
    setAddable(listAddableMedicines())
  }

  // Увімкнути / вимкнути врахування хвороби в їжі (coding-guide.md §11 AffectsFood).
  const handleToggleRule = (condition) => {
    const current = rules[condition.tagKey]
    const relation = current?.relation ?? condition.defaultRelation
    const enabled = !(current?.enabled ?? false)
    setRules({ ...setRule(condition.tagKey, { relation, enabled }) })
  }

  const handleRelation = (condition, relation) => {
    setRules({ ...setRule(condition.tagKey, { relation, enabled: true }) })
  }

  const resetCondForm = () => setCondForm({ open: false, name: '', affectsFood: false, tag: '', relation: 'Avoid' })

  const handleAddCondition = () => {
    if (!condForm.name.trim()) return
    addCondition({
      name: condForm.name,
      affectsFood: condForm.affectsFood,
      tag: condForm.tag,
      relation: condForm.relation,
    })
    setConditions(listConditions())
    setRules(getRules())
    resetCondForm()
  }

  const addableFiltered = addable.filter((m) =>
    medName(m, language).toLowerCase().includes(medSearch.trim().toLowerCase()),
  )

  return (
    <div className="health-page">
      <div className="page-head">
        <h2>{t('nav.health')}</h2>
        <span className="variant-note">{t('health.note')}</span>
      </div>

      <div className="profile-kv">
        <div className="profile-field">
          <span className="profile-field-label">{t('health.profile.weight')}</span>
          <span className="profile-field-value">61 {t('health.unit.kg')}</span>
        </div>
        <div className="profile-field">
          <span className="profile-field-label">{t('health.profile.age')}</span>
          <span className="profile-field-value">27 {t('health.unit.years')}</span>
        </div>
        <div className="profile-field">
          <span className="profile-field-label">{t('health.profile.height')}</span>
          <span className="profile-field-value">168 {t('health.unit.cm')}</span>
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

          <div className="health-pills">
            <button
              type="button"
              className={category === 'all' ? 'pill pill--active' : 'pill'}
              onClick={() => setCategory('all')}
            >
              {t('health.filterAll')}
            </button>
            {MEDICINE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={category === c.key ? 'pill pill--active' : 'pill'}
                onClick={() => setCategory(c.key)}
              >
                {categoryName(c.key, language)}
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
                  <th>{t('health.col.expiry')}</th>
                  <th>{t('health.col.conflicts')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleMeds.map((m) => {
                  const conflicts = medConflicts(m, language)
                  const substance = medSubstance(m, language)
                  return (
                    <tr key={m.id}>
                      <td>{medName(m, language)}</td>
                      <td>
                        <span className="category-badge">{categoryName(m.category, language)}</span>
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
                              onClick={() => handleMedState(m.id, s)}
                            />
                          ))}
                        </div>
                      </td>
                      <td>
                        {m.expiry ? t('health.expiryPrefix', { date: m.expiry }) : <span className="none-text">—</span>}
                      </td>
                      <td>
                        {conflicts.length > 0 ? (
                          <div className="conflict-tags">
                            {conflicts.map((c) => (
                              <span key={c} className="conflict-tag">
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="none-text">
                            {substance ? t('health.noConflicts') : t('health.notSubstance')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
            {conditions.map((condition) => {
              const rule = rules[condition.tagKey]
              const enabled = rule?.enabled ?? false
              const relation = rule?.relation ?? condition.defaultRelation
              return (
                <li key={condition.id} className="condition-row">
                  <span className="condition-name">{conditionName(condition, language)}</span>
                  {condition.affectsFood ? (
                    <>
                      <span className="condition-tag">{conditionTag(condition, language)}</span>
                      <select
                        className="rule-select"
                        value={relation}
                        disabled={!enabled}
                        onChange={(e) => handleRelation(condition, e.target.value)}
                      >
                        <option value="Forbidden">{t('health.rule.forbidden')}</option>
                        <option value="Avoid">{t('health.rule.avoid')}</option>
                      </select>
                      <label className="switch-wrap">
                        <span className="switch-label">{t('health.affectsFood')}</span>
                        <span className="switch">
                          <input type="checkbox" checked={enabled} onChange={() => handleToggleRule(condition)} />
                          <span className="switch-track" />
                        </span>
                      </label>
                    </>
                  ) : (
                    <span className="none-text">{t('health.affectsNo')}</span>
                  )}
                </li>
              )
            })}
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
              onChange={(e) => setMedSearch(e.target.value)}
            />
            <ul className="drawer-product-list">
              {addableFiltered.map((m) => (
                <li key={m.id}>
                  <span>{medName(m, language)}</span>
                  <button type="button" className="pill" onClick={() => handleAddMed(m.id)}>
                    {t('health.add')}
                  </button>
                </li>
              ))}
              {addableFiltered.length === 0 && <li className="none-text">{t('health.addMedEmpty')}</li>}
            </ul>
          </aside>
        </div>
      )}
    </div>
  )
}
