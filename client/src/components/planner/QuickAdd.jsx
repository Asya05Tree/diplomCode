import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { parseInput } from '../../utils/nlp'
import { createTask } from '../../api/tasks'
import { addSubject } from '../../api/study'
import { addStockByName, productName } from '../../api/food'
import { getQuickAddStatus, consumeQuickAdd, checkoutQuickAdd, confirmPayment } from '../../api/billing'
import { combineDuration, splitDuration, todayApiDate } from '../../utils/date'
import './QuickAdd.css'

// Модулі, у які вміє класифікувати парсер (+ "звичайна"). none-модуль → "tasks".
const MODULES = ['tasks', 'shopping', 'media', 'food', 'health', 'study', 'work', 'finance', 'notes']

// Грубе зіставлення назв предметів (родовий відмінок «математики» ≈ «Математика»):
// порівнюємо перші літери основ без урахування регістру.
function sameSubject(a, b) {
  const norm = (x) => (x || '').trim().toLowerCase()
  const x = norm(a); const y = norm(b)
  if (!x || !y) return false
  const k = Math.min(5, x.length, y.length)
  return x.slice(0, k) === y.slice(0, k)
}

// Розпізнаний task → редагований рядок форми підтвердження.
function toRow(task) {
  const { hours, minutes } = splitDuration(task.durationMinutes || 0)
  const s = task.study || {}
  return {
    title: task.title,
    date: task.date,
    deadline: task.deadline || '',
    time: task.time,
    durH: hours,
    durM: minutes,
    module: task.module || 'tasks',
    confidence: task.confidence || 'high',
    ambiguous: task.ambiguous,
    raw: task.raw,
    inheritedDate: Boolean(task.inheritedDate),
    inheritedDeadline: Boolean(task.inheritedDeadline),
    subject: s.subject || '',
    teacher: s.teacher || '',
    lessonNumber: s.lessonNumber || '',
    link: s.link || '',
    createSubject: false, // проставляємо під час розбору, якщо предмет новий
    include: Boolean(task.title), // задачі без назви лишаємо непозначеними, доки назву не додано
  }
}

// Швидке додавання задач із природномовного рядка (укр./англ.). Розбір — на правилах
// (utils/nlp), задачі ніколи не створюються автоматично: спершу екран підтвердження.
// subjects — наявні предмети Навчання (для зіставлення/створення); canAddSubjects —
// чи користувач школяр/студент (інакше предмет у Навчанні створити не можна).
export default function QuickAdd({ token, onCreated, subjects = [], canAddSubjects = false, products = [], stock = {} }) {
  const { t, language } = useI18n()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null) // { tasks, notRecognized, language, stock } або null
  const [rows, setRows] = useState([])
  const [stockRows, setStockRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  // Платна фіча: стан ліміту (used/remaining/unlocked/price) і екрани оплати.
  const [status, setStatus] = useState(null)
  const [paywall, setPaywall] = useState(false)       // екран "розблокувати за N ₴"
  const [checkout, setCheckout] = useState(null)      // дані мок-оплати { orderReference, amount, currency }
  const [payBusy, setPayBusy] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const refreshStatus = () => getQuickAddStatus().then(setStatus).catch(() => {})

  // Початковий стан ліміту.
  useEffect(() => { refreshStatus() }, [])

  // Повернення з платіжки (?paid=orderReference): підтверджуємо оплату й чистимо URL.
  useEffect(() => {
    const paid = searchParams.get('paid')
    if (!paid) return
    const sp = new URLSearchParams(searchParams)
    sp.delete('paid')
    setSearchParams(sp, { replace: true })
    confirmPayment(paid)
      .then((res) => {
        if (res?.paid) { setStatus(res.status); setPaywall(false); setCheckout(null); setNote(t('quickAdd.pay.success')) }
        else setNote(t('quickAdd.pay.failed'))
      })
      .catch(() => setNote(t('quickAdd.pay.failed')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const price = status?.price ?? 100

  // Старт оплати: мок → власна сторінка-картка; WayForPay → автосабміт форми на їхню сторінку.
  const buyNow = async () => {
    setPayBusy(true)
    try {
      const res = await checkoutQuickAdd()
      if (res?.alreadyUnlocked) { await refreshStatus(); setPaywall(false); return }
      if (res?.mock) {
        setCheckout(res)
      } else if (res?.action && res?.fields) {
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = res.action
        for (const [k, v] of Object.entries(res.fields)) {
          const input = document.createElement('input')
          input.type = 'hidden'; input.name = k; input.value = v
          form.appendChild(input)
        }
        document.body.appendChild(form)
        form.submit()
      }
    } catch {
      setNote(t('quickAdd.pay.failed'))
    } finally {
      setPayBusy(false)
    }
  }

  // Підтвердження мок-оплати (демо: картка не перевіряється, гроші не списуються).
  const confirmMockPay = async () => {
    if (!checkout) return
    setPayBusy(true)
    try {
      const res = await confirmPayment(checkout.orderReference)
      if (res?.paid) { setStatus(res.status); setCheckout(null); setPaywall(false); setNote(t('quickAdd.pay.success')) }
      else setNote(t('quickAdd.pay.failed'))
    } catch {
      setNote(t('quickAdd.pay.failed'))
    } finally {
      setPayBusy(false)
    }
  }

  const findSubject = (name) => subjects.find((s) => sameSubject(s.name, name))

  // Статус продукту для запасів: present — уже в наявності, known — є в довіднику, new — новий.
  const stockStatus = (name) => {
    const norm = (x) => (x || '').trim().toLowerCase()
    const p = products.find((pr) => norm(productName(pr, language)) === norm(name)
      || norm(pr.nameUk) === norm(name) || norm(pr.nameEn) === norm(name))
    if (p && stock[p.id] && stock[p.id] !== 'OutOfStock') return 'present'
    if (p) return 'known'
    return 'new'
  }

  const handleParse = () => {
    setNote('')
    // Назви наявних предметів передаємо у фаззі-шар — щоб виправляти й помилки в них.
    const parsed = parseInput(text, new Date(), subjects.map((s) => s.name).filter(Boolean))
    const stockItems = (parsed.stock || []).flatMap((s) => s.items)
    if (!parsed.tasks.length && !parsed.notRecognized.length && !stockItems.length) {
      setNote(t('quickAdd.nothing'))
      return
    }
    setResult(parsed)
    setRows(parsed.tasks.map((task) => {
      const r = toRow(task)
      // Новий предмет (є назва, але немає в Навчанні) — за замовчуванням пропонуємо додати.
      if (r.module === 'study' && r.subject && canAddSubjects && !findSubject(r.subject)) {
        r.createSubject = true
      }
      return r
    }))
    setStockRows(stockItems.map((name) => ({ name, include: true, status: stockStatus(name) })))
  }

  const close = () => {
    setResult(null)
    setRows([])
    setStockRows([])
  }

  const patchStock = (i, changes) => setStockRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...changes } : r)))

  const patch = (i, changes) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...changes } : r)))

  // Вибір для неоднозначного числа: застосувати дату/час і прибрати цей чузер із рядка.
  const chooseAmbiguous = (i, ambIndex, option) => {
    setRows((rs) => rs.map((r, idx) => {
      if (idx !== i) return r
      const next = { ...r, ambiguous: r.ambiguous.filter((_, k) => k !== ambIndex) }
      if (option && option.date) next.date = option.date
      if (option && option.time) next.time = option.time
      return next
    }))
  }

  const createAll = async () => {
    const toCreate = rows.filter((r) => r.include && r.title.trim())
    const toStock = stockRows.filter((r) => r.include && r.name.trim())
    if (!toCreate.length && !toStock.length) { close(); return }
    setBusy(true)
    try {
      // Платний гейт: списуємо одне безкоштовне використання (або пропуск, якщо куплено).
      // 402 → ліміт вичерпано: показуємо paywall і НЕ створюємо (екран розбору лишається позаду).
      try {
        const st = await consumeQuickAdd()
        setStatus(st)
      } catch (e) {
        if (e.message === 'limit_reached') { setPaywall(true); return }
        throw e
      }

      for (const r of toCreate) {
        // Навчання: за потреби спершу створюємо предмет (помилка не зриває створення задачі).
        if (r.module === 'study' && r.createSubject && r.subject.trim() && canAddSubjects && !findSubject(r.subject)) {
          try {
            await addSubject({
              name: r.subject.trim(),
              teacher: r.teacher.trim() || null,
              color: null,
              lectureRoom: null,
              lectureLink: r.link.trim() || null,
              seminarRoom: null,
              seminarLink: null,
            })
          } catch { /* предмет не критичний — задачу все одно створюємо */ }
        }

        let startDateTime = null
        if (r.date) startDateTime = `${r.date}T${r.time || '09:00'}:00`
        else if (r.time) startDateTime = `${todayApiDate()}T${r.time}:00`
        // Номер пари (Навчання) кладемо в опис — окремого поля в задачі немає.
        const description = r.module === 'study' && r.lessonNumber
          ? t('quickAdd.lessonNumberDesc', { n: r.lessonNumber })
          : null
        await createTask(token, {
          title: r.title.trim(),
          description,
          startDateTime,
          durationMinutes: combineDuration(r.durH, r.durM),
          deadline: r.deadline ? `${r.deadline}T23:59:00` : null,
          moduleCode: r.module,
        })
      }
      // Запаси: додаємо за назвою (сервер знаходить/створює продукт і повертає, чи вже був).
      let stockAdded = 0; let stockAlready = 0
      for (const r of toStock) {
        try {
          const res = await addStockByName(r.name.trim())
          if (res?.alreadyInStock) stockAlready += 1
          else stockAdded += 1
        } catch { /* один продукт не критичний */ }
      }

      const parts = []
      if (toCreate.length) parts.push(t('quickAdd.created', { count: toCreate.length }))
      if (stockAdded) parts.push(t('quickAdd.stockAdded', { count: stockAdded }))
      if (stockAlready) parts.push(t('quickAdd.stockAlready', { count: stockAlready }))
      setNote(parts.join(' · '))
      setText('')
      close()
      onCreated?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="quick-add card">
      <div className="quick-add-bar">
        <input
          type="text"
          className="quick-add-input"
          value={text}
          placeholder={t('quickAdd.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleParse() } }}
        />
        <button type="button" className="btn-accent quick-add-btn" onClick={handleParse} disabled={!text.trim()}>
          <Icon name="sparkles" />
          {t('quickAdd.parse')}
        </button>
      </div>
      <p className="quick-add-hint">{t('quickAdd.hint')}</p>

      {status && (
        <div className="quick-add-plan">
          {status.unlocked ? (
            <span className="qa-plan qa-plan--pro"><Icon name="check" /> {t('quickAdd.plan.unlocked')}</span>
          ) : (
            <>
              <span className="qa-plan">{t('quickAdd.plan.free', { n: status.remaining })}</span>
              <button type="button" className="qa-plan-unlock" onClick={() => setPaywall(true)}>{t('quickAdd.plan.unlock')}</button>
            </>
          )}
        </div>
      )}

      {note && !result && <p className="quick-add-note">{note}</p>}

      {result && (
        <div className="quick-add-modal-backdrop" onClick={close}>
          <div className="quick-add-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('quickAdd.modalTitle')}</h3>
            <p className="quick-add-modal-hint">{t('quickAdd.modalHint')}</p>

            {result.corrections?.length > 0 && (
              <p className="quick-add-corrections">
                <Icon name="sparkles" /> {t('quickAdd.corrections')}{' '}
                {result.corrections.map((c, k) => (
                  <span key={k}>{k > 0 && ', '}<b>{c.from}</b> → {c.to}</span>
                ))}
              </p>
            )}

            <div className="quick-add-rows">
              {rows.map((r, i) => (
                <div className={`qa-row${r.include ? '' : ' qa-row--off'}`} key={i}>
                  <label className="qa-check">
                    <input type="checkbox" checked={r.include} onChange={(e) => patch(i, { include: e.target.checked })} />
                  </label>

                  <div className="qa-fields">
                    {r.confidence !== 'high' && (
                      <div className={`qa-conf qa-conf--${r.confidence}`}>
                        {r.confidence === 'low' ? t('quickAdd.conf.low') : t('quickAdd.conf.medium')}
                      </div>
                    )}
                    <label className="qa-field qa-field--title">
                      <span>{t('quickAdd.field.title')}</span>
                      <input type="text" value={r.title} onChange={(e) => patch(i, { title: e.target.value, include: r.include || Boolean(e.target.value.trim()) })} />
                      {!r.title.trim() && <small className="qa-warn">{t('quickAdd.titleRequired')}</small>}
                    </label>

                    <label className="qa-field">
                      <span><Icon name="calendar" /> {t('quickAdd.field.date')}</span>
                      <input type="date" value={r.date} onChange={(e) => patch(i, { date: e.target.value, inheritedDate: false })} />
                      {r.inheritedDate && <small className="qa-hint-inline">{t('quickAdd.inheritedDate')}</small>}
                    </label>

                    <label className="qa-field">
                      <span><Icon name="calendar" /> {t('quickAdd.field.deadline')}</span>
                      <input type="date" value={r.deadline} onChange={(e) => patch(i, { deadline: e.target.value, inheritedDeadline: false })} />
                      {r.inheritedDeadline && <small className="qa-hint-inline">{t('quickAdd.inheritedDeadline')}</small>}
                    </label>

                    <label className="qa-field">
                      <span><Icon name="clock" /> {t('quickAdd.field.time')}</span>
                      <input type="time" value={r.time} onChange={(e) => patch(i, { time: e.target.value })} />
                    </label>

                    <div className="qa-field qa-field--dur">
                      <span>{t('quickAdd.field.duration')}</span>
                      <div className="qa-dur">
                        <input type="number" min="0" max="8" value={r.durH} onChange={(e) => patch(i, { durH: Number(e.target.value) || 0 })} />
                        <em>{t('quickAdd.hours')}</em>
                        <input type="number" min="0" max="59" value={r.durM} onChange={(e) => patch(i, { durM: Number(e.target.value) || 0 })} />
                        <em>{t('quickAdd.minutes')}</em>
                      </div>
                    </div>

                    <label className="qa-field">
                      <span><Icon name="tag" /> {t('quickAdd.field.module')}</span>
                      <select value={r.module} onChange={(e) => patch(i, { module: e.target.value })}>
                        {MODULES.map((code) => (
                          <option key={code} value={code}>{t(`quickAdd.module.${code}`)}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Навчання: предмет + викладач (+ пропозиція додати у Навчання, якщо новий) */}
                  {r.module === 'study' && (
                    <div className="qa-study">
                      <label className="qa-field">
                        <span>{t('quickAdd.field.subject')}</span>
                        <input type="text" value={r.subject} onChange={(e) => patch(i, { subject: e.target.value })} />
                      </label>
                      <label className="qa-field">
                        <span>{t('quickAdd.field.teacher')}</span>
                        <input type="text" value={r.teacher} onChange={(e) => patch(i, { teacher: e.target.value })} />
                      </label>
                      <label className="qa-field qa-field--num">
                        <span>{t('quickAdd.field.lessonNumber')}</span>
                        <input type="number" min="1" max="12" value={r.lessonNumber} onChange={(e) => patch(i, { lessonNumber: e.target.value ? Number(e.target.value) : '' })} />
                      </label>
                      {canAddSubjects && r.subject.trim() && (
                        findSubject(r.subject) ? (
                          <span className="qa-study-found"><Icon name="check" /> {t('quickAdd.subjectFound')}</span>
                        ) : (
                          <label className="qa-study-new">
                            <input type="checkbox" checked={r.createSubject} onChange={(e) => patch(i, { createSubject: e.target.checked })} />
                            {t('quickAdd.subjectNew')}
                          </label>
                        )
                      )}
                    </div>
                  )}

                  {r.ambiguous.map((amb, ambIndex) => (
                    <div className="qa-ambiguous" key={ambIndex}>
                      <span className="qa-amb-label">{t('quickAdd.ambiguous', { raw: amb.raw })}</span>
                      <div className="qa-amb-opts">
                        {amb.options.map((opt) => (
                          <button type="button" key={opt.key} className="qa-amb-opt" onClick={() => chooseAmbiguous(i, ambIndex, opt)}>
                            {opt.key === 'day' ? t('quickAdd.opt.day', { n: amb.n }) : opt.time}
                          </button>
                        ))}
                        <button type="button" className="qa-amb-opt qa-amb-opt--skip" onClick={() => chooseAmbiguous(i, ambIndex, null)}>
                          {t('quickAdd.opt.skip')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {stockRows.length > 0 && (
              <div className="qa-stock">
                <div className="qa-stock-title"><Icon name="tag" /> {t('quickAdd.stockTitle')}</div>
                <p className="qa-stock-hint">{t('quickAdd.stockHint')}</p>
                {stockRows.map((r, i) => (
                  <div className={`qa-stock-row${r.include ? '' : ' qa-row--off'}`} key={i}>
                    <label className="qa-check">
                      <input type="checkbox" checked={r.include} onChange={(e) => patchStock(i, { include: e.target.checked })} />
                    </label>
                    <input className="qa-stock-name" type="text" value={r.name} onChange={(e) => patchStock(i, { name: e.target.value, status: stockStatus(e.target.value) })} />
                    <span className={`qa-stock-badge qa-stock-badge--${r.status}`}>{t(`quickAdd.stock.${r.status}`)}</span>
                  </div>
                ))}
              </div>
            )}

            {result.notRecognized.length > 0 && (
              <div className="qa-unrec">
                <div className="qa-unrec-title"><Icon name="warning" /> {t('quickAdd.notRecognized')}</div>
                <p className="qa-unrec-hint">{t('quickAdd.notRecognizedHint')}</p>
                <ul>{result.notRecognized.map((frag, k) => <li key={k}>{frag}</li>)}</ul>
              </div>
            )}

            <div className="quick-add-modal-actions">
              <button type="button" className="btn-ghost" onClick={close} disabled={busy}>{t('common.cancel')}</button>
              <button type="button" className="btn-accent" onClick={createAll} disabled={busy || (!rows.some((r) => r.include && r.title.trim()) && !stockRows.some((r) => r.include && r.name.trim()))}>
                {busy ? t('quickAdd.creating') : t('quickAdd.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paywall: ліміт вичерпано → пропозиція розблокувати назавжди. */}
      {paywall && (
        <div className="quick-add-modal-backdrop" onClick={() => !payBusy && setPaywall(false)}>
          <div className="quick-add-modal qa-pay" onClick={(e) => e.stopPropagation()}>
            {!checkout ? (
              <>
                <div className="qa-pay-badge"><Icon name="sparkles" /></div>
                <h3>{t('quickAdd.pay.title')}</h3>
                <p className="quick-add-modal-hint">{t('quickAdd.pay.body', { price })}</p>
                <ul className="qa-pay-perks">
                  <li><Icon name="check" /> {t('quickAdd.pay.perk1')}</li>
                  <li><Icon name="check" /> {t('quickAdd.pay.perk2')}</li>
                </ul>
                <div className="quick-add-modal-actions">
                  <button type="button" className="btn-ghost" onClick={() => setPaywall(false)} disabled={payBusy}>{t('common.cancel')}</button>
                  <button type="button" className="btn-accent" onClick={buyNow} disabled={payBusy}>
                    {payBusy ? t('quickAdd.pay.processing') : t('quickAdd.pay.buy', { price })}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>{t('quickAdd.pay.mockTitle')}</h3>
                <p className="quick-add-modal-hint">{t('quickAdd.pay.mockHint')}</p>
                <div className="qa-card">
                  <label className="qa-field">
                    <span>{t('quickAdd.pay.cardNumber')}</span>
                    <input type="text" inputMode="numeric" defaultValue="4242 4242 4242 4242" />
                  </label>
                  <div className="qa-card-row">
                    <label className="qa-field"><span>{t('quickAdd.pay.expiry')}</span><input type="text" defaultValue="12/29" /></label>
                    <label className="qa-field"><span>{t('quickAdd.pay.cvv')}</span><input type="text" defaultValue="123" /></label>
                  </div>
                  <div className="qa-card-amount">{t('quickAdd.pay.amount', { price })}</div>
                </div>
                <div className="quick-add-modal-actions">
                  <button type="button" className="btn-ghost" onClick={() => setCheckout(null)} disabled={payBusy}>{t('common.cancel')}</button>
                  <button type="button" className="btn-accent" onClick={confirmMockPay} disabled={payBusy}>
                    {payBusy ? t('quickAdd.pay.processing') : t('quickAdd.pay.payNow', { price })}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
