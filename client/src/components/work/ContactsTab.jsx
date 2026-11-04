import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getContacts, addContact, updateContact, removeContact } from '../../api/work'

// Контакти за групами. ПІБ окремими полями (прізвище / ім'я / по батькові). День народження — лише
// число й місяць (рік не зберігаємо, показуємо без року). Соцмережі — Telegram / Viber (за бажанням).
const EMPTY = {
  groupName: '', lastName: '', firstName: '', middleName: '',
  phone: '', email: '', bMonth: '', bDay: '', telegram: '', viber: '',
}

const pad2 = (n) => String(n).padStart(2, '0')

export default function ContactsTab() {
  const { t, language } = useI18n()
  const [contacts, setContacts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const locale = language === 'en' ? 'en-US' : 'uk-UA'
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' })),
    [locale],
  )

  // День народження як "число місяць" без року (зберігається з умовним роком 2000).
  const formatBirthday = (iso) => {
    if (!iso) return ''
    const [, m, d] = iso.split('-').map(Number)
    if (!m || !d) return ''
    return new Date(2000, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
  }

  const reload = () => getContacts().then(setContacts).catch(() => setContacts([]))
  useEffect(() => { reload() }, [])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setError(''); setShowForm(true) }
  const openEdit = (c) => {
    const parts = (c.fullName || '').trim().split(/\s+/)
    const [, m, d] = (c.birthday || '').split('-').map((x) => Number(x) || '')
    setEditingId(c.id)
    setForm({
      groupName: c.groupName ?? '',
      lastName: parts[0] ?? '',
      firstName: parts[1] ?? '',
      middleName: parts.slice(2).join(' '),
      phone: c.phone ?? '',
      email: c.email ?? '',
      bMonth: m ? String(m) : '',
      bDay: d ? String(d) : '',
      telegram: c.telegram ?? '',
      viber: c.viber ?? '',
    })
    setError('')
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const fullName = [form.lastName, form.firstName, form.middleName].map((s) => s.trim()).filter(Boolean).join(' ')
    if (!fullName) { setError(t('work.errContactName')); return }
    const birthday = form.bMonth && form.bDay ? `2000-${pad2(form.bMonth)}-${pad2(form.bDay)}` : null
    const payload = {
      groupName: form.groupName.trim() || t('work.ungrouped'),
      fullName,
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      birthday,
      telegram: form.telegram.trim() || null,
      viber: form.viber.trim() || null,
    }
    if (editingId) await updateContact(editingId, payload)
    else await addContact(payload)
    setShowForm(false)
    setForm(EMPTY)
    setEditingId(null)
    await reload()
  }

  const del = async (id) => { await removeContact(id); await reload() }

  // Групуємо за назвою групи, зберігаючи алфавітний порядок груп
  const groups = useMemo(() => {
    const map = new Map()
    for (const c of contacts) {
      const key = c.groupName || t('work.ungrouped')
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(c)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'uk'))
  }, [contacts, t])

  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')

  return (
    <div className="card">
      <div className="work-section-head">
        <h3>{t('work.contactsTitle')}</h3>
        <button type="button" className="btn-accent" onClick={showForm ? () => setShowForm(false) : openAdd}>
          {showForm ? t('common.cancel') : t('work.addContact')}
        </button>
      </div>

      {showForm && (
        <form className="work-form" onSubmit={submit}>
          <div className="work-form-grid">
            <label>{t('work.lastName')}<input value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} /></label>
            <label>{t('work.firstName')}<input value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} /></label>
            <label>{t('work.middleName')} <span className="work-optional">({t('work.optional')})</span><input value={form.middleName} onChange={(e) => set({ middleName: e.target.value })} /></label>
            <label>{t('work.group')}<input value={form.groupName} onChange={(e) => set({ groupName: e.target.value })} placeholder={t('work.groupPlaceholder')} /></label>
            <label>{t('work.phone')}<input value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
            <label>{t('work.email')} <span className="work-optional">({t('work.optional')})</span><input value={form.email} onChange={(e) => set({ email: e.target.value })} /></label>
            <label>{t('work.birthday')} <span className="work-optional">({t('work.optional')})</span>
              <div className="work-bday">
                <select value={form.bDay} onChange={(e) => set({ bDay: e.target.value })}>
                  <option value="">{t('work.bdayDay')}</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={form.bMonth} onChange={(e) => set({ bMonth: e.target.value })}>
                  <option value="">{t('work.bdayMonth')}</option>
                  {monthNames.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
                </select>
              </div>
            </label>
            <label>{t('work.telegram')} <span className="work-optional">({t('work.optional')})</span><input value={form.telegram} onChange={(e) => set({ telegram: e.target.value })} placeholder="@username" /></label>
            <label>{t('work.viber')} <span className="work-optional">({t('work.optional')})</span><input value={form.viber} onChange={(e) => set({ viber: e.target.value })} placeholder="+380…" /></label>
          </div>
          {error && <p className="task-form-error">{error}</p>}
          <div className="work-form-actions">
            <button type="submit" className="btn-accent">{t('common.save')}</button>
          </div>
        </form>
      )}

      {contacts.length === 0 && !showForm && <p className="placeholder-text">{t('work.noContacts')}</p>}

      {groups.map(([groupName, list]) => (
        <div key={groupName}>
          <div className="work-group-head"><h4>{groupName}</h4><span className="work-group-count">{list.length}</span></div>
          <div className="work-contact-list">
            {list.map((c) => (
              <div key={c.id} className="work-contact-card">
                <div className="work-contact-avatar">{initials(c.fullName)}</div>
                <div className="work-contact-body">
                  <span className="work-contact-name">{c.fullName}</span>
                  {c.phone && <span className="work-contact-line">{c.phone}</span>}
                  {c.email && <span className="work-contact-line">{c.email}</span>}
                  {c.birthday && <span className="work-contact-line"><Icon name="cake" />{formatBirthday(c.birthday)}</span>}
                  {c.telegram && <span className="work-contact-line work-contact-socials">Telegram: {c.telegram}</span>}
                  {c.viber && <span className="work-contact-line work-contact-socials">Viber: {c.viber}</span>}
                </div>
                <div className="work-contact-actions">
                  <button type="button" className="work-icon-btn" onClick={() => openEdit(c)} aria-label={t('common.edit')}><Icon name="pencil" /></button>
                  <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => del(c.id)} aria-label={t('common.delete')}><Icon name="trash" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
