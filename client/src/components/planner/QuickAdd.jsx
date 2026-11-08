import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { parseInput, findUnsupportedChars } from '../../utils/nlp'
import { createTask } from '../../api/tasks'
import { addSubject } from '../../api/study'
import { addStockByName, productName, recipeName, toggleSelected } from '../../api/food'
import { addShoppingItem } from '../../api/shopping'
import { addNote } from '../../api/notes'
import { addTransaction } from '../../api/finance'
import { addMedia } from '../../api/media'
import { addVisit } from '../../api/checkup'
import { addMeeting } from '../../api/work'
import { getQuickAddStatus, consumeQuickAdd, checkoutQuickAdd, confirmPayment } from '../../api/billing'
import { combineDuration, splitDuration, todayApiDate } from '../../utils/date'
import './QuickAdd.css'

// Модулі, у які вміє класифікувати парсер (+ "звичайна"). none-модуль → "tasks".
const MODULES = ['tasks', 'shopping', 'media', 'food', 'health', 'study', 'work', 'finance', 'notes']

// Кольори для нотаток-«квадратиків» (мають збігатися з Notes.jsx).
const NOTE_COLORS = ['#fff3b0', '#cdeffd', '#d7f5d3', '#ffd6e0', '#e5d4ff', '#ffe0b3']

// Ключ вкладки «Список покупок» у модалці (решта не-модульних ключів — нижче).
const SHOPLIST_TAB = '__shoplist__'

// Лікарі чекапу (ключ enum) за словом у тексті — для «записатися до …» (health → візит).
const DOCTOR_MAP = [
  [/стоматолог|дантист|зубн|dentist/i, 'dentist'],
  [/окуліст|офтальмолог|ophthalmolog/i, 'ophthalmologist'],
  [/отоларинголог|\bлор\b|otolaryngolog|\bent\b/i, 'otolaryngologist'],
  [/кардіолог|cardiolog/i, 'cardiologist'],
  [/дерматолог|dermatolog/i, 'dermatologist'],
  [/невролог|neurolog/i, 'neurologist'],
  [/гастроентеролог|gastroenterolog/i, 'gastroenterologist'],
  [/ендокринолог|endocrinolog/i, 'endocrinologist'],
  [/хірург|surgeon/i, 'surgeon'],
  [/гінеколог|gynecolog/i, 'gynecologist'],
  [/уролог|urolog/i, 'urologist'],
  [/психотерапевт|psychotherap/i, 'psychotherapist'],
  [/ортопед|orthoped/i, 'orthopedist'],
  [/педіатр|pediatric/i, 'pediatrician'],
  [/терапевт|therapist/i, 'therapist'],
]
// Слова-маркери наміру ЗАПИСАТИСЯ на прийом (а не «прийняти ліки» — та лишається задачею).
const APPOINTMENT_RE = /записат|запис на|на прийом|прийом до|чекап|візит|огляд|appointment|checkup|book.*(doctor|dentist)/i
// Слова-маркери ЗУСТРІЧІ в Роботі (інакше work лишається звичайною задачею).
const MEETING_RE = /нарад|зустріч|перемов|планерк|співбесід|meeting|stand-?up|interview/i
// Прості правила «ключове слово → категорія фінансів» (решта — без категорії).
const FINANCE_CAT_MAP = [
  [/інтернет|зв'язок|мобільн|телефон|phone|internet|communication/i, 'communication'],
  [/комунал|світло|газ|\bвод|опален|utilit/i, 'utilities'],
  [/оренд|житло|квартплат|іпотек|rent|mortgage|housing/i, 'housing'],
  [/кафе|ресторан|dining|restaurant|cafe/i, 'dining'],
  [/продукт|їж|groc|food/i, 'food'],
  [/транспорт|проїзд|метро|автобус|паливо|бензин|transport|fuel/i, 'transport'],
  [/ліки|аптек|health|medic|pharmac/i, 'health'],
  [/податок|збір|\btax/i, 'taxes'],
  [/кредит|борг|позик|loan|debt/i, 'loans'],
  [/підписк|subscription/i, 'subscriptions'],
  [/навчанн|курс|education|tuition/i, 'education'],
]

// М'яка межа довжини вводу: лічильник підсвічується, але текст НЕ обрізається (QA-11) —
// багаторядкове поле приймає скільки завгодно, обрізання браузером більше немає.
const MAX_INPUT = 1000

// Ключ вкладки "Запаси" у модалці підтвердження (решта вкладок — коди модулів).
const STOCK_TAB = '__stock__'

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
    amount: task.amount ?? '',
    currency: task.currency || null,
    financeType: task.financeType || 'expense',
    negated: Boolean(task.negated),
    extraDates: task.extraDates || [],
    extraTimes: task.extraTimes || [],
    // Задачі без назви — непозначені; low-confidence теж знімаємо, щоб не створити сміття
    // одним кліком (QA-16). Користувач явно поставить галочку, якщо справді треба.
    include: Boolean(task.title) && task.confidence !== 'low',
  }
}

// Швидке додавання задач із природномовного рядка (укр./англ.). Розбір — на правилах
// (utils/nlp), задачі ніколи не створюються автоматично: спершу екран підтвердження.
// subjects — наявні предмети Навчання (для зіставлення/створення); canAddSubjects —
// чи користувач школяр/студент (інакше предмет у Навчанні створити не можна).
export default function QuickAdd({ token, onCreated, subjects = [], canAddSubjects = false, products = [], stock = {}, recipes = [] }) {
  const { t, language } = useI18n()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null) // { tasks, notRecognized, language, stock } або null
  const [rows, setRows] = useState([])
  const [stockRows, setStockRows] = useState([])
  const [shopRows, setShopRows] = useState([]) // пункти списку покупок ("…до списку покупок")
  const [activeTab, setActiveTab] = useState(null) // активна вкладка модалки (код модуля або STOCK_TAB)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [langWarn, setLangWarn] = useState('') // попередження про мову у модалці (не блокує)

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

  // Рецепт за назвою у тексті ("приготувати борщ" → рецепт «Борщ»), регістронезалежно.
  const findRecipe = (title) => {
    const low = (title || '').toLowerCase()
    return recipes.find((r) => {
      const n = (recipeName(r, language) || '').toLowerCase().trim()
      return n && low.includes(n)
    })
  }

  // Куди піде рядок при «Створити»: сутність модуля чи звичайна задача (QA-07). Заперечення
  // ("не купувати") завжди лишає просту задачу — без побічних ефектів (QA-12).
  const classifyRow = (r) => {
    if (r.negated) return 'task'
    const title = (r.title || '').toLowerCase()
    if (r.module === 'finance' && r.amount !== '' && Number(r.amount) > 0) return 'finance'
    if (r.module === 'notes') return 'note'
    if (r.module === 'media') return 'media'
    if (r.module === 'health' && APPOINTMENT_RE.test(title)) return 'visit'
    if (r.module === 'work' && MEETING_RE.test(title)) return 'meeting'
    if (r.module === 'food' && findRecipe(title)) return 'recipe'
    return 'task'
  }

  const financeCategoryFor = (title) => {
    const low = (title || '').toLowerCase()
    for (const [re, key] of FINANCE_CAT_MAP) if (re.test(low)) return key
    return null
  }
  const doctorKeyFor = (title) => {
    for (const [re, key] of DOCTOR_MAP) if (re.test(title || '')) return key
    return 'family'
  }

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
    setLangWarn('')
    // Чужі символи (напр. рос. ы/э) більше НЕ блокують розбір: парсимо best-effort і лише
    // попереджаємо в модалці (інакше один символ ховав увесь коректний текст — QA-03).
    const badChars = findUnsupportedChars(text)
    // Назви наявних предметів передаємо у фаззі-шар — щоб виправляти й помилки в них.
    const parsed = parseInput(text, new Date(), subjects.map((s) => s.name).filter(Boolean))
    const stockItems = (parsed.stock || []).flatMap((s) => s.items)
    const shopItems = (parsed.shoppingList || []).flatMap((s) => s.items)
    if (!parsed.tasks.length && !parsed.notRecognized.length && !stockItems.length && !shopItems.length) {
      // Нічого не розпізнано: якщо були чужі символи — пояснюємо їх, інакше загальна нота.
      setNote(badChars.length ? t('quickAdd.unsupportedLang', { chars: badChars.join(' ') }) : t('quickAdd.nothing'))
      return
    }
    // Попередження про мову показуємо вгорі модалки, не втрачаючи розпізнане (QA-03/QA-04).
    setLangWarn(badChars.length
      ? t('quickAdd.partialWarn', { chars: badChars.join(' ') })
      : (parsed.suspectedUnsupportedLang ? t('quickAdd.suspectLang') : ''))
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
    setShopRows(shopItems.map((name) => ({ name, include: true })))
    setActiveTab(null) // почнемо з першої вкладки (визначається під час рендеру)
  }

  const close = () => {
    setResult(null)
    setRows([])
    setStockRows([])
    setShopRows([])
    setActiveTab(null)
    setLangWarn('')
  }

  const patchShop = (i, changes) => setShopRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...changes } : r)))

  const patchStock = (i, changes) => setStockRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...changes } : r)))

  const patch = (i, changes) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...changes } : r)))

  // Вибір для неоднозначного числа: застосувати дату/час і прибрати цей чузер із рядка.
  // «Пропустити» (option=null) повертає сире число В НАЗВУ, а не губить його (QA-15).
  const chooseAmbiguous = (i, ambIndex, option) => {
    setRows((rs) => rs.map((r, idx) => {
      if (idx !== i) return r
      const amb = r.ambiguous[ambIndex]
      const next = { ...r, ambiguous: r.ambiguous.filter((_, k) => k !== ambIndex) }
      if (option && option.date) next.date = option.date
      else if (option && option.time) next.time = option.time
      else if (amb) next.title = `${r.title} ${amb.raw}`.trim() // пропущене число → у назву
      return next
    }))
  }

  // Друга дата/час в одній задачі (QA-09): створити з неї ОКРЕМУ задачу (клон рядка) і
  // прибрати цей «зайвий» зі списку, щоб нічого не губилось тихо.
  const spawnFromExtra = (i, kind, value) => {
    setRows((rs) => {
      const r = rs[i]
      if (!r) return rs
      const clone = {
        ...r,
        date: kind === 'date' ? value : r.date,
        time: kind === 'time' ? value : r.time,
        extraDates: [], extraTimes: [], ambiguous: [], include: true,
        inheritedDate: false, inheritedDeadline: false,
      }
      const trimmed = {
        ...r,
        extraDates: kind === 'date' ? r.extraDates.filter((d) => d !== value) : r.extraDates,
        extraTimes: kind === 'time' ? r.extraTimes.filter((tm) => tm !== value) : r.extraTimes,
      }
      const out = rs.slice()
      out[i] = trimmed
      out.splice(i + 1, 0, clone)
      return out
    })
  }

  // Прибрати «зайву» дату/час без створення задачі (користувач свідомо ігнорує).
  const dismissExtra = (i, kind, value) => {
    patch(i, kind === 'date'
      ? { extraDates: rows[i].extraDates.filter((d) => d !== value) }
      : { extraTimes: rows[i].extraTimes.filter((tm) => tm !== value) })
  }

  // Створити звичайну календарну задачу з рядка (fallback-маршрут + Навчання/Покупки/«прийняти ліки»).
  const createCalendarTask = async (r) => {
    // Навчання: за потреби спершу створюємо предмет (помилка не зриває створення задачі).
    if (r.module === 'study' && r.createSubject && r.subject.trim() && canAddSubjects && !findSubject(r.subject)) {
      try {
        await addSubject({
          name: r.subject.trim(), teacher: r.teacher.trim() || null, color: null,
          lectureRoom: null, lectureLink: r.link.trim() || null, seminarRoom: null, seminarLink: null,
        })
      } catch { /* предмет не критичний — задачу все одно створюємо */ }
    }
    let startDateTime = null
    if (r.date) startDateTime = `${r.date}T${r.time || '09:00'}:00`
    else if (r.time) startDateTime = `${todayApiDate()}T${r.time}:00`
    const description = r.module === 'study' && r.lessonNumber
      ? t('quickAdd.lessonNumberDesc', { n: r.lessonNumber })
      : null
    await createTask(token, {
      title: r.title.trim(), description, startDateTime,
      durationMinutes: combineDuration(r.durH, r.durM),
      deadline: r.deadline ? `${r.deadline}T23:59:00` : null,
      moduleCode: r.module,
    })
  }

  const createAll = async () => {
    const toCreate = rows.filter((r) => r.include && r.title.trim())
    const toStock = stockRows.filter((r) => r.include && r.name.trim())
    const toShop = shopRows.filter((r) => r.include && r.name.trim())
    if (!toCreate.length && !toStock.length && !toShop.length) { close(); return }
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

      // Лічильники створених сутностей (для підсумкової ноти).
      const made = { task: 0, finance: 0, note: 0, media: 0, visit: 0, meeting: 0, recipe: 0 }
      for (const r of toCreate) {
        const when = r.date ? `${r.date}T${r.time || '09:00'}:00` : (r.time ? `${todayApiDate()}T${r.time}:00` : null)
        try {
          switch (classifyRow(r)) {
            case 'finance': // → операція у Фінансах (QA-10): сума, напрямок, категорія
              await addTransaction({
                amount: Number(r.amount),
                type: r.financeType === 'income' ? 'Income' : 'Expense',
                category: financeCategoryFor(r.title),
                description: r.title.trim(),
                occurredAt: r.date ? `${r.date}T12:00:00` : null,
              })
              made.finance += 1; break
            case 'note': // → нотатка (QA-07c)
              await addNote({ text: r.title.trim(), color: NOTE_COLORS[made.note % NOTE_COLORS.length] })
              made.note += 1; break
            case 'media': { // → список перегляду/читання (QA-07)
              const isBook = /книг|книж|почит|прочит|read a book|book/i.test(r.title)
              await addMedia({ kind: isBook ? 'book' : 'video', title: r.title.trim() })
              made.media += 1; break
            }
            case 'visit': // → візит у Чекапі (health «записатися до…»)
              await addVisit({
                doctorKey: doctorKeyFor(r.title),
                doctorName: t(`checkup.doctor.${doctorKeyFor(r.title)}`),
                when: when || `${todayApiDate()}T09:00:00`,
                place: null, note: r.title.trim(),
              })
              made.visit += 1; break
            case 'meeting': // → зустріч у Роботі
              await addMeeting({ withWhom: r.title.trim(), when: when || `${todayApiDate()}T09:00:00`, place: null })
              made.meeting += 1; break
            case 'recipe': { // → додати страву у «вибрані» (прив'язка до рецепта)
              const rec = findRecipe(r.title)
              if (rec) { await toggleSelected(rec.id, true); made.recipe += 1 } else { await createCalendarTask(r); made.task += 1 }
              break
            }
            default:
              await createCalendarTask(r); made.task += 1
          }
        } catch {
          // Якщо маршрут-сутність не вдалась — не втрачаємо намір: лишаємо хоча б задачу.
          try { await createCalendarTask(r); made.task += 1 } catch { /* один рядок не критичний */ }
        }
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
      // Список покупок: вільний текст → пункт секції «Продукти».
      let shopAdded = 0
      for (const r of toShop) {
        try { await addShoppingItem({ section: 'Groceries', text: r.name.trim() }); shopAdded += 1 } catch { /* не критичний */ }
      }

      const parts = []
      if (made.task) parts.push(t('quickAdd.created', { count: made.task }))
      if (made.finance) parts.push(t('quickAdd.sum.finance', { n: made.finance }))
      if (made.note) parts.push(t('quickAdd.sum.notes', { n: made.note }))
      if (made.media) parts.push(t('quickAdd.sum.media', { n: made.media }))
      if (made.visit) parts.push(t('quickAdd.sum.visits', { n: made.visit }))
      if (made.meeting) parts.push(t('quickAdd.sum.meetings', { n: made.meeting }))
      if (made.recipe) parts.push(t('quickAdd.sum.recipe', { n: made.recipe }))
      if (shopAdded) parts.push(t('quickAdd.sum.shopping', { n: shopAdded }))
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

  // Вкладки модалки: по одній на кожен присутній модуль (у порядку MODULES) + "Запаси", якщо є продукти.
  const tabs = []
  for (const code of MODULES) {
    const count = rows.filter((r) => r.module === code).length
    if (count) tabs.push({ key: code, label: t(`quickAdd.module.${code}`), count })
  }
  if (shopRows.length) tabs.push({ key: SHOPLIST_TAB, label: t('quickAdd.shopListTitle'), count: shopRows.length })
  if (stockRows.length) tabs.push({ key: STOCK_TAB, label: t('quickAdd.stockTitle'), count: stockRows.length })
  // Активна вкладка: збережена, якщо ще існує, інакше перша наявна.
  const currentTab = tabs.some((tb) => tb.key === activeTab) ? activeTab : (tabs[0]?.key ?? null)

  // Підсумок «що саме буде створено» — щоб ефект на інших вкладках не був невидимим (QA-18).
  const summary = (() => {
    const by = {}
    for (const r of rows) {
      if (!r.include || !r.title.trim()) continue
      const k = classifyRow(r)
      by[k] = (by[k] || 0) + 1
    }
    const nShop = shopRows.filter((r) => r.include && r.name.trim()).length
    const nStock = stockRows.filter((r) => r.include && r.name.trim()).length
    const label = { task: 'quickAdd.sum.tasks', finance: 'quickAdd.sum.finance', note: 'quickAdd.sum.notes', media: 'quickAdd.sum.media', visit: 'quickAdd.sum.visits', meeting: 'quickAdd.sum.meetings', recipe: 'quickAdd.sum.recipe' }
    const out = []
    for (const k of Object.keys(label)) if (by[k]) out.push(t(label[k], { n: by[k] }))
    if (nShop) out.push(t('quickAdd.sum.shopping', { n: nShop }))
    if (nStock) out.push(t('quickAdd.sum.stockShort', { n: nStock }))
    return out
  })()

  // Зміна модуля переносить рядок на вкладку цього модуля — одразу туди й перемикаємось, щоб не "загубити" рядок.
  const changeModule = (i, module) => {
    patch(i, { module })
    setActiveTab(module)
  }

  return (
    <div className="quick-add card">
      <div className="quick-add-bar">
        <textarea
          className="quick-add-input"
          value={text}
          rows={2}
          placeholder={t('quickAdd.placeholder')}
          onChange={(e) => setText(e.target.value)}
          // Кожен рядок — окрема задача; Enter переносить рядок, Ctrl/⌘+Enter запускає розбір.
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleParse() } }}
        />
        <button type="button" className="btn-accent quick-add-btn" onClick={handleParse} disabled={!text.trim()}>
          <Icon name="sparkles" />
          {t('quickAdd.parse')}
        </button>
      </div>
      <div className="quick-add-hintrow">
        <p className="quick-add-hint">{t('quickAdd.hint')}</p>
        <span className={`quick-add-count${text.length > MAX_INPUT ? ' quick-add-count--full' : ''}`}>
          {text.length}
        </span>
      </div>

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

            {langWarn && (
              <p className="quick-add-warn"><Icon name="warning" /> {langWarn}</p>
            )}

            {result.corrections?.length > 0 && (
              <p className="quick-add-corrections">
                <Icon name="sparkles" /> {t('quickAdd.corrections')}{' '}
                {result.corrections.map((c, k) => (
                  <span key={k}>{k > 0 && ', '}<b>{c.from}</b> → {c.to}</span>
                ))}
              </p>
            )}

            {tabs.length > 1 && (
              <div className="qa-tabs">
                {tabs.map((tb) => (
                  <button
                    type="button"
                    key={tb.key}
                    className={`qa-tab${tb.key === currentTab ? ' qa-tab--active' : ''}`}
                    onClick={() => setActiveTab(tb.key)}
                  >
                    {tb.label}
                    <span className="qa-tab-count">{tb.count}</span>
                  </button>
                ))}
              </div>
            )}

            {currentTab !== STOCK_TAB && (
            <div className="quick-add-rows">
              {rows.map((r, i) => [r, i]).filter(([row]) => row.module === currentTab).map(([r, i]) => (
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
                    {r.negated && (
                      <div className="qa-conf qa-conf--neg">{t('quickAdd.negated')}</div>
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
                      <select value={r.module} onChange={(e) => changeModule(i, e.target.value)}>
                        {MODULES.map((code) => (
                          <option key={code} value={code}>{t(`quickAdd.module.${code}`)}</option>
                        ))}
                      </select>
                    </label>

                    {/* Фінанси: сума та напрямок (дохід/витрата) → створиться операція у Фінансах */}
                    {r.module === 'finance' && (
                      <>
                        <label className="qa-field qa-field--num">
                          <span>{t('quickAdd.field.amount')}</span>
                          <input type="number" min="0" step="0.01" value={r.amount}
                            onChange={(e) => patch(i, { amount: e.target.value === '' ? '' : Number(e.target.value) })} />
                        </label>
                        <label className="qa-field">
                          <span>{t('quickAdd.field.financeType')}</span>
                          <select value={r.financeType} onChange={(e) => patch(i, { financeType: e.target.value })}>
                            <option value="expense">{t('quickAdd.finance.expense')}</option>
                            <option value="income">{t('quickAdd.finance.income')}</option>
                          </select>
                        </label>
                      </>
                    )}
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

                  {/* Друга дата/час у задачі (QA-09): не губимо — пропонуємо окрему задачу або ігнор */}
                  {(r.extraDates.length > 0 || r.extraTimes.length > 0) && (
                    <div className="qa-extra">
                      <span className="qa-extra-label"><Icon name="warning" /> {t('quickAdd.extraFound')}</span>
                      {r.extraDates.map((d) => (
                        <span className="qa-extra-item" key={`d${d}`}>
                          {d}
                          <button type="button" onClick={() => spawnFromExtra(i, 'date', d)}>{t('quickAdd.extraSeparate')}</button>
                          <button type="button" className="qa-extra-x" onClick={() => dismissExtra(i, 'date', d)}>×</button>
                        </span>
                      ))}
                      {r.extraTimes.map((tm) => (
                        <span className="qa-extra-item" key={`t${tm}`}>
                          {tm}
                          <button type="button" onClick={() => spawnFromExtra(i, 'time', tm)}>{t('quickAdd.extraSeparate')}</button>
                          <button type="button" className="qa-extra-x" onClick={() => dismissExtra(i, 'time', tm)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}

            {currentTab === SHOPLIST_TAB && (
              <div className="qa-stock">
                <div className="qa-stock-title"><Icon name="tag" /> {t('quickAdd.shopListTitle')}</div>
                <p className="qa-stock-hint">{t('quickAdd.shopListHint')}</p>
                {shopRows.map((r, i) => (
                  <div className={`qa-stock-row${r.include ? '' : ' qa-row--off'}`} key={i}>
                    <label className="qa-check">
                      <input type="checkbox" checked={r.include} onChange={(e) => patchShop(i, { include: e.target.checked })} />
                    </label>
                    <input className="qa-stock-name" type="text" value={r.name} onChange={(e) => patchShop(i, { name: e.target.value })} />
                  </div>
                ))}
              </div>
            )}

            {currentTab === STOCK_TAB && (
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

            {/* Зведення: що саме буде створено (щоб позначене на інших вкладках не було «невидимим», QA-18) */}
            {summary.length > 0 && (
              <p className="quick-add-summary">{t('quickAdd.willCreate')} {summary.join(' · ')}</p>
            )}

            <div className="quick-add-modal-actions">
              <button type="button" className="btn-ghost" onClick={close} disabled={busy}>{t('common.cancel')}</button>
              <button type="button" className="btn-accent" onClick={createAll} disabled={busy || (!rows.some((r) => r.include && r.title.trim()) && !stockRows.some((r) => r.include && r.name.trim()) && !shopRows.some((r) => r.include && r.name.trim()))}>
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
            {/* Явний банер демо-режиму над кнопкою оплати (problems.md #7) — не лише в документації. */}
            <div className="qa-pay-demo">
              <Icon name="info" /> {t('quickAdd.pay.demoBanner')}
            </div>
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
