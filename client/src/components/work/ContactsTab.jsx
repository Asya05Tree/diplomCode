import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getContacts, addContact, updateContact, removeContact } from '../../api/work'
import { CONTACT_STATUSES } from './workShared'

// Контакти за групами й статусом (ПІБ і телефон обов'язкові; пошта, день народження та соцмережі —
// за бажанням). Групи — довільний текст; у списку контакти згруповані за назвою групи.
const EMPTY = { groupName: '', status: 'online', fullName: '', phone: '', email: '', birthday: '', socials: '' }

export default function ContactsTab() {
  const { t, formatDate } = useI18n()
  const [contacts, setContacts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const reload = () => getContacts().then(setContacts).catch(() => setContacts([]))
  useEffect(() => { reload() }, [])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setError(''); setShowForm(true) }
  const openEdit = (c) => {
    setEditingId(c.id)
    setForm({
      groupName: c.groupName ?? '', status: c.status ?? 'online', fullName: c.fullName ?? '',
      phone: c.phone ?? '', email: c.email ?? '', birthday: c.birthday ?? '', socials: c.socials ?? '',
    })
    setError('')
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.fullName.trim()) { setError(t('work.errContactName')); return }
    const payload = {
      groupName: form.groupName.trim() || t('work.ungrouped'),
      status: form.status,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      birthday: form.birthday || null,
      socials: form.socials.trim() || null,
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
            <label>{t('work.fullName')}<input value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} /></label>
            <label>{t('work.group')}<input value={form.groupName} onChange={(e) => set({ groupName: e.target.value })} placeholder={t('work.groupPlaceholder')} /></label>
            <label>{t('work.status')}
              <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
                {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{t(`work.contactStatus.${s}`)}</option>)}
              </select>
            </label>
            <label>{t('work.phone')}<input value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
            <label>{t('work.email')} <span className="work-optional">({t('work.optional')})</span><input value={form.email} onChange={(e) => set({ email: e.target.value })} /></label>
            <label>{t('work.birthday')} <span className="work-optional">({t('work.optional')})</span><input type="date" value={form.birthday} onChange={(e) => set({ birthday: e.target.value })} /></label>
            <label className="work-form-wide">{t('work.socials')} <span className="work-optional">({t('work.optional')})</span><input value={form.socials} onChange={(e) => set({ socials: e.target.value })} placeholder="IG @name · TG @name" /></label>
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
                  <span className={`work-cstatus work-cstatus--${c.status}`}>{t(`work.contactStatus.${c.status}`)}</span>
                  <span className="work-contact-line"><Icon name="bell" />{c.phone || '—'}</span>
                  {c.email && <span className="work-contact-line"><Icon name="arrow-right" />{c.email}</span>}
                  {c.birthday && <span className="work-contact-line"><Icon name="cake" />{formatDate(c.birthday)}</span>}
                  {c.socials && <span className="work-contact-line work-contact-socials">{c.socials}</span>}
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
