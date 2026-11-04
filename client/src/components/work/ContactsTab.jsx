import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { getContacts, addContact, updateContact, removeContact } from '../../api/work'
import { phoneDigits, phoneOperator, operatorName, OPERATOR_ORDER, splitPhones, dedupPhones } from '../../utils/phone'

// Робочі контакти. ПІБ рядками (прізвище / ім'я / по батькові). День народження — лише число й місяць.
// До 3 телефонів (зберігаються одним рядком через кому). Пошта й Telegram — за бажанням. Групи й
// Viber прибрано. Додавання/редагування відкривається панеллю справа (як запаси в "Їжі").
// Подання: за абеткою, за оператором (визначається з номера), за соцмережею, за поштою.
const MAX_PHONES = 3
const EMPTY = { lastName: '', firstName: '', middleName: '', bMonth: '', bDay: '', phones: [''], email: '', telegram: '' }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const pad2 = (n) => String(n).padStart(2, '0')
const normName = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
const normTg = (s) => (s || '').trim().toLowerCase().replace(/^@+/, '')

export default function ContactsTab() {
  const { t, language } = useI18n()
  const [contacts, setContacts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [mergeNote, setMergeNote] = useState(false)
  const [view, setView] = useState('alpha') // alpha | operator | social | email

  const locale = language === 'en' ? 'en-US' : 'uk-UA'
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' })),
    [locale],
  )

  const formatBirthday = (iso) => {
    if (!iso) return ''
    const [, m, d] = iso.split('-').map(Number)
    if (!m || !d) return ''
    return new Date(2000, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
  }

  const reload = () => getContacts().then(setContacts).catch(() => setContacts([]))
  useEffect(() => { reload() }, [])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setPhone = (i, value) => setForm((f) => ({ ...f, phones: f.phones.map((p, j) => (j === i ? value : p)) }))
  const addPhoneField = () => setForm((f) => (f.phones.length < MAX_PHONES ? { ...f, phones: [...f.phones, ''] } : f))
  const removePhoneField = (i) => setForm((f) => ({ ...f, phones: f.phones.filter((_, j) => j !== i) }))

  const closeForm = () => { setShowForm(false); setForm(EMPTY); setEditingId(null); setError(''); setMergeNote(false) }

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setError(''); setMergeNote(false); setShowForm(true) }

  const openEdit = (c) => {
    const parts = (c.fullName || '').trim().split(/\s+/)
    const [, m, d] = (c.birthday || '').split('-').map((x) => Number(x) || '')
    const phones = splitPhones(c.phone)
    setEditingId(c.id)
    setForm({
      lastName: parts[0] ?? '',
      firstName: parts[1] ?? '',
      middleName: parts.slice(2).join(' '),
      bMonth: m ? String(m) : '',
      bDay: d ? String(d) : '',
      phones: phones.length ? phones : [''],
      email: c.email ?? '',
      telegram: c.telegram ?? '',
    })
    setError('')
    setMergeNote(false)
    setShowForm(true)
  }

  // Пошук наявного контакту-дубля для нового запису: спершу за ПІБ, потім за номером, потім за Telegram.
  const findDuplicate = ({ fullName, phones, telegram }) => {
    const nn = normName(fullName)
    const byName = contacts.find((c) => normName(c.fullName) === nn)
    if (byName) return { contact: byName, reason: 'name' }
    const digits = phones.map(phoneDigits).filter(Boolean)
    if (digits.length) {
      const byPhone = contacts.find((c) => splitPhones(c.phone).map(phoneDigits).some((d) => d && digits.includes(d)))
      if (byPhone) return { contact: byPhone, reason: 'phone' }
    }
    const tg = normTg(telegram)
    if (tg) {
      const byTg = contacts.find((c) => normTg(c.telegram) === tg)
      if (byTg) return { contact: byTg, reason: 'telegram' }
    }
    return null
  }

  // Злиття нового запису в наявний: відкриваємо старий на редагування з об'єднаними даними —
  // номери додаються (макс. 3), інші поля беремо з наявного, решту користувач звіряє вручну.
  const mergeIntoEdit = (existing, inc) => {
    const parts = (existing.fullName || '').trim().split(/\s+/)
    const [, m, d] = (existing.birthday || '').split('-').map((x) => Number(x) || '')
    const merged = dedupPhones([...splitPhones(existing.phone), ...inc.phones])
    if (merged.length > MAX_PHONES) alert(t('work.phonesCapped'))
    const phones = merged.slice(0, MAX_PHONES)
    const incM = inc.birthday ? Number(inc.birthday.split('-')[1]) : ''
    const incD = inc.birthday ? Number(inc.birthday.split('-')[2]) : ''
    setEditingId(existing.id)
    setForm({
      lastName: parts[0] ?? '',
      firstName: parts[1] ?? '',
      middleName: parts.slice(2).join(' '),
      bMonth: m ? String(m) : (incM ? String(incM) : ''),
      bDay: d ? String(d) : (incD ? String(incD) : ''),
      phones: phones.length ? phones : [''],
      email: existing.email || inc.email || '',
      telegram: existing.telegram || inc.telegram || '',
    })
    setMergeNote(true)
    setError('')
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const lastName = form.lastName.trim()
    const firstName = form.firstName.trim()
    const middleName = form.middleName.trim()
    if (!lastName) { setError(t('work.errLastName')); return }
    if (!firstName) { setError(t('work.errFirstName')); return }

    const phones = dedupPhones(form.phones.map((p) => p.trim()).filter(Boolean)).slice(0, MAX_PHONES)
    for (const p of phones) {
      const len = phoneDigits(p).length
      if (len < 7 || len > 15) { setError(t('work.errPhone')); return }
    }
    const email = form.email.trim()
    if (email && !EMAIL_RE.test(email)) { setError(t('work.errEmail')); return }
    const telegram = form.telegram.trim()

    const fullName = [lastName, firstName, middleName].filter(Boolean).join(' ')
    const birthday = form.bMonth && form.bDay ? `2000-${pad2(form.bMonth)}-${pad2(form.bDay)}` : null

    // Дедуплікація лише при створенні нового: той самий ПІБ/номер/Telegram → редагуємо наявний.
    if (!editingId) {
      const dup = findDuplicate({ fullName, phones, telegram })
      if (dup) {
        const key = dup.reason === 'name' ? 'work.mergeExistingName'
          : dup.reason === 'phone' ? 'work.mergeExistingPhone' : 'work.mergeExistingTelegram'
        if (!window.confirm(t(key, { name: dup.contact.fullName }))) return
        mergeIntoEdit(dup.contact, { lastName, firstName, middleName, birthday, phones, email, telegram })
        return
      }
    }

    const payload = {
      groupName: '',
      fullName,
      phone: phones.join(', '),
      email: email || null,
      birthday,
      telegram: telegram || null,
      viber: null,
    }
    if (editingId) await updateContact(editingId, payload)
    else await addContact(payload)
    closeForm()
    await reload()
  }

  const del = async (id) => { await removeContact(id); await reload() }

  const operatorOf = (c) => {
    const first = splitPhones(c.phone)[0]
    return first ? phoneOperator(first) : 'none'
  }
  const operatorLabel = (key) => operatorName(key) || (key === 'none' ? t('work.operatorNone') : t('work.operatorOther'))

  // Подання контактів: завжди за абеткою ПІБ, згруповані залежно від обраного режиму.
  const groups = useMemo(() => {
    const sorted = [...contacts].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'uk'))
    if (view === 'operator') {
      const map = new Map()
      for (const c of sorted) {
        const key = operatorOf(c)
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(c)
      }
      return OPERATOR_ORDER.filter((k) => map.has(k)).map((k) => [operatorLabel(k), map.get(k)])
    }
    if (view === 'social') {
      const has = sorted.filter((c) => c.telegram)
      const no = sorted.filter((c) => !c.telegram)
      return [[t('work.hasSocial'), has], [t('work.noSocial'), no]].filter(([, l]) => l.length)
    }
    if (view === 'email') {
      const has = sorted.filter((c) => c.email)
      const no = sorted.filter((c) => !c.email)
      return [[t('work.hasEmail'), has], [t('work.noEmail'), no]].filter(([, l]) => l.length)
    }
    return [['', sorted]] // alpha — без заголовків груп
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, view, language])

  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')

  const VIEWS = [
    { key: 'alpha', label: t('work.viewAlpha') },
    { key: 'operator', label: t('work.viewOperator') },
    { key: 'social', label: t('work.viewSocial') },
    { key: 'email', label: t('work.viewEmail') },
  ]

  return (
    <div className="card">
      <div className="work-section-head">
        <h3>{t('work.contactsTitle')}</h3>
        <button type="button" className="btn-accent" onClick={openAdd}>{t('work.addContact')}</button>
      </div>

      <div className="work-pills work-contact-views">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className={view === v.key ? 'work-pill work-pill--active' : 'work-pill'}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {contacts.length === 0 && <p className="placeholder-text">{t('work.noContacts')}</p>}

      {groups.map(([groupName, list]) => (
        <div key={groupName || 'all'}>
          {groupName && (
            <div className="work-group-head"><h4>{groupName}</h4><span className="work-group-count">{list.length}</span></div>
          )}
          <div className="work-contact-list">
            {list.map((c) => (
              <div key={c.id} className="work-contact-card">
                <div className="work-contact-avatar">{initials(c.fullName)}</div>
                <div className="work-contact-body">
                  <span className="work-contact-name">{c.fullName}</span>
                  {splitPhones(c.phone).map((p) => <span key={p} className="work-contact-line">{p}</span>)}
                  {c.email && <span className="work-contact-line">{c.email}</span>}
                  {c.birthday && <span className="work-contact-line"><Icon name="cake" />{formatBirthday(c.birthday)}</span>}
                  {c.telegram && <span className="work-contact-line work-contact-socials">Telegram: {c.telegram}</span>}
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

      {showForm && (
        <div className="drawer-overlay drawer-overlay--open">
          <div className="drawer-backdrop" onClick={closeForm} />
          <aside className="drawer-panel">
            <div className="drawer-head">
              <h3>{editingId ? t('work.editContact') : t('work.newContact')}</h3>
              <button type="button" className="drawer-close" onClick={closeForm} aria-label={t('common.cancel')}><Icon name="close" /></button>
            </div>

            {mergeNote && <p className="contact-merge-note">{t('work.mergeNote')}</p>}

            <form className="contact-form" onSubmit={submit}>
              <label>{t('work.lastName')}
                <input value={form.lastName} maxLength={40} onChange={(e) => set({ lastName: e.target.value })} />
              </label>
              <label>{t('work.firstName')}
                <input value={form.firstName} maxLength={40} onChange={(e) => set({ firstName: e.target.value })} />
              </label>
              <label><span className="work-label-head">{t('work.middleName')} <span className="work-optional">({t('work.optional')})</span></span>
                <input value={form.middleName} maxLength={40} onChange={(e) => set({ middleName: e.target.value })} />
              </label>

              <label><span className="work-label-head">{t('work.birthday')} <span className="work-optional">({t('work.optional')})</span></span>
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

              <div className="contact-phones">
                <span className="work-field-label">{t('work.phones')} <span className="work-optional">({t('work.phonesHint')})</span></span>
                {form.phones.map((p, i) => (
                  <div className="contact-phone-row" key={i}>
                    <input value={p} inputMode="tel" maxLength={20} placeholder={t('work.phonePlaceholder')} onChange={(e) => setPhone(i, e.target.value)} />
                    {form.phones.length > 1 && (
                      <button type="button" className="work-icon-btn work-icon-btn--danger" onClick={() => removePhoneField(i)} aria-label={t('common.delete')}><Icon name="close" /></button>
                    )}
                  </div>
                ))}
                {form.phones.length < MAX_PHONES && (
                  <button type="button" className="work-pill contact-add-phone" onClick={addPhoneField}>{t('work.addPhone')}</button>
                )}
              </div>

              <label><span className="work-label-head">{t('work.email')} <span className="work-optional">({t('work.optional')})</span></span>
                <input type="email" value={form.email} maxLength={120} placeholder="name@mail.com" onChange={(e) => set({ email: e.target.value })} />
              </label>
              <label><span className="work-label-head">{t('work.telegram')} <span className="work-optional">({t('work.optional')})</span></span>
                <input value={form.telegram} maxLength={40} placeholder="@username" onChange={(e) => set({ telegram: e.target.value })} />
              </label>

              {error && <p className="task-form-error">{error}</p>}
              <div className="work-form-actions">
                <button type="submit" className="btn-accent">{t('common.save')}</button>
                <button type="button" className="btn-outline" onClick={closeForm}>{t('common.cancel')}</button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  )
}
