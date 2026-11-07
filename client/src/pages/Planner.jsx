import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useI18n } from '../i18n'
import MonthGrid from '../components/planner/MonthGrid'
import ModeSwitch from '../components/planner/ModeSwitch'
import NumberStepper from '../components/NumberStepper'
import DayView from '../components/planner/DayView'
import PeriodView from '../components/planner/PeriodView'
import RecurringView from '../components/planner/RecurringView'
import UnassignedView from '../components/planner/UnassignedView'
import DebtsView from '../components/planner/DebtsView'
import CareBanner from '../components/CareBanner'
import { getFreeDays, getPeriodTasks, getUnassignedCount } from '../api/tasks'
import { getCycle } from '../api/cycle'
import { loadDebts } from '../utils/debts'
import { buildHeavyDays } from '../utils/cycle'
import { addDays, getMonthGridCells, fromApiDate, startOfDay, toApiDate, todayApiDate } from '../utils/date'
import './Planner.css'

const AUTH_TOKEN_KEY = 'authToken'

// Головний екран (planner-spec.md §4.2): ліва сітка — контекст, права частина — робоча область
// із трьома режимами (§4.3). Базове відображення сітки (§4.4) — дні із задачами або з недостатнім
// запасом вільного часу підсвічені кольором, порожні дні без заливки; працює завжди, без перемикача.
export default function Planner() {
  const { t, weekStart } = useI18n()
  const { gender, studentType } = useOutletContext() ?? {}
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [mode, setMode] = useState('day')
  // Три рівноправні вкладки робочої області (planner-spec.md §4.2): 'dayPeriod' | 'recurring' | 'unassigned'
  const [activeTab, setActiveTab] = useState('dayPeriod')
  const [periodRange, setPeriodRange] = useState(() => {
    const from = new Date()
    return { from, to: addDays(from, 6) }
  })
  const [minFreeHours, setMinFreeHours] = useState(2)
  const [busyMarkings, setBusyMarkings] = useState(new Map())
  const [recurringMarkings, setRecurringMarkings] = useState(new Map())
  const [unassignedCount, setUnassignedCount] = useState(0)
  // Важливі борги: прострочені дедлайни навчання/роботи (збираються з доменних API, оновлюються
  // після будь-якої зміни задач).
  const [debts, setDebts] = useState([])
  // Тип Manual (RecurringView): клік по дню в лівій сітці = вставити/зняти ручну дату
  const [manualDateHandler, setManualDateHandler] = useState(null)
  // Бампається після будь-якої зміни задач у Дні/Періоді/Нерозподілених, щоб заливка сітки
  // й лічильник на вкладці "Нерозподілені" не застарівали
  const [tasksVersion, setTasksVersion] = useState(0)
  const notifyTasksChanged = () => setTasksVersion((v) => v + 1)
  // Робочі дні (moduleCode="work": зміни з графіка + зустрічі) — позначаються іконкою роботи в сітці
  const [workDays, setWorkDays] = useState(() => new Set())
  // Дні місячних (факт дня) для жіночих профілів; бампаємо після позначення з Дня
  const [periodDays, setPeriodDays] = useState(() => new Set())
  // "Важкі дні" (дні менструації: факт + прогноз) і прапорець турботи — для мʼякого нагадування
  // відпочити, коли увімкнено "знижувати навантаження у важкі дні" (Цикл §3.7)
  const [heavyDays, setHeavyDays] = useState(() => new Set())
  const [reduceLoad, setReduceLoad] = useState(false)
  const [cycleVersion, setCycleVersion] = useState(0)
  const notifyCycleChanged = () => setCycleVersion((v) => v + 1)

  const visibleGridRange = useMemo(() => {
    const cells = getMonthGridCells(visibleMonth.getFullYear(), visibleMonth.getMonth(), weekStart)
    return { from: cells[0].date, to: cells[cells.length - 1].date }
  }, [visibleMonth, weekStart])

  useEffect(() => {
    if (activeTab !== 'dayPeriod') return
    let cancelled = false

    Promise.all([
      getPeriodTasks(token, visibleGridRange.from, visibleGridRange.to),
      getFreeDays(token, visibleGridRange.from, visibleGridRange.to, minFreeHours),
    ])
      .then(([tasks, freeDays]) => {
        if (cancelled) return
        const map = new Map()
        for (const task of tasks) {
          if (task.startDateTime) map.set(task.startDateTime.slice(0, 10), 'busy')
        }
        for (const day of freeDays) {
          if (!day.isFreeEnough) map.set(day.date, 'busy')
        }
        setBusyMarkings(map)
      })
      .catch(() => {
        if (!cancelled) setBusyMarkings(new Map())
      })

    return () => {
      cancelled = true
    }
  }, [token, visibleGridRange, minFreeHours, activeTab, tasksVersion])

  // Робочі дні для сітки: збираємо дати задач/змін moduleCode="work" у видимому діапазоні.
  // Окремий ефект (не лише на вкладці "День/Період"), щоб іконка роботи була в сітці завжди.
  useEffect(() => {
    let cancelled = false
    getPeriodTasks(token, visibleGridRange.from, visibleGridRange.to)
      .then((tasks) => {
        if (cancelled) return
        const set = new Set()
        for (const task of tasks) {
          if (task.moduleCode === 'work' && task.startDateTime) set.add(task.startDateTime.slice(0, 10))
        }
        setWorkDays(set)
      })
      .catch(() => { if (!cancelled) setWorkDays(new Set()) })
    return () => { cancelled = true }
  }, [token, visibleGridRange, tasksVersion])

  // Лічильник на вкладці "Нерозподілені" (раніше показувався в сайдбарі) — оновлюється
  // після будь-якої зміни задач, незалежно від того, яка вкладка зараз активна
  useEffect(() => {
    getUnassignedCount(token)
      .then((res) => setUnassignedCount(res.count))
      .catch(() => {})
  }, [token, tasksVersion])

  // Важливі борги оновлюємо на старті й після будь-якої зміни задач
  useEffect(() => {
    let cancelled = false
    loadDebts(studentType)
      .then((list) => { if (!cancelled) setDebts(list) })
      .catch(() => { if (!cancelled) setDebts([]) })
    return () => { cancelled = true }
  }, [studentType, tasksVersion])

  // Дні місячних для сітки: лише для жіночих профілів; будуємо Set 'YYYY-MM-DD' із записів циклу
  useEffect(() => {
    if (gender !== 'female') {
      setPeriodDays(new Set())
      setHeavyDays(new Set())
      setReduceLoad(false)
      return
    }
    let cancelled = false
    getCycle()
      .then((data) => {
        if (cancelled) return
        const set = new Set()
        const today = startOfDay(new Date())
        for (const r of data?.records ?? []) {
          if (!r.startDate) continue
          let d = fromApiDate(r.startDate)
          const end = r.endDate ? fromApiDate(r.endDate) : today // відкритий період — до сьогодні
          for (let guard = 0; d <= end && guard < 400; guard++) {
            set.add(toApiDate(d))
            d = addDays(d, 1)
          }
        }
        setPeriodDays(set)
        setHeavyDays(buildHeavyDays(data?.records ?? [], data?.forecast ?? null))
        setReduceLoad(Boolean(data?.settings?.reduceLoadOnHeavyDays))
      })
      .catch(() => {
        if (!cancelled) {
          setPeriodDays(new Set())
          setHeavyDays(new Set())
          setReduceLoad(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [gender, cycleVersion])

  const markings = activeTab === 'recurring' ? recurringMarkings : busyMarkings

  // Турбота у "важкі дні": банер на головному екрані, якщо важкий день — сьогодні; у вкладці
  // "День" — якщо важким є саме обраний день (тоді натяк "запланувати менше" влучає в контекст).
  const showCareToday = reduceLoad && heavyDays.has(todayApiDate())
  const careForSelectedDay = reduceLoad && heavyDays.has(toApiDate(selectedDate))

  const handleSelectDate = (date) => {
    // Якщо саме триває вибір ручних дат повторення — лишаємо цю поведінку (вставка/зняття дати)
    if (activeTab === 'recurring' && manualDateHandler) {
      manualDateHandler(date)
      return
    }
    // Інакше клік по дню завжди відкриває День цього дня (з Періоду/Нерозподілених/Повторюваних теж)
    setActiveTab('dayPeriod')
    setMode('day')
    setSelectedDate(date)
  }

  return (
    <div className="planner">
      {showCareToday && <CareBanner />}

      <section className="planner-grid-panel card">
        <MonthGrid
          visibleMonth={visibleMonth}
          onMonthChange={setVisibleMonth}
          selectedDate={activeTab === 'dayPeriod' && mode === 'day' ? selectedDate : null}
          onSelectDate={handleSelectDate}
          markings={markings}
          periodDays={periodDays}
          workDays={workDays}
        />

        {activeTab === 'dayPeriod' && (
          <div className="planner-free-hours">
            <label>
              {t('planner.minFreeHours')}
              <NumberStepper
                min={1}
                max={24}
                value={minFreeHours}
                onChange={(v) => setMinFreeHours(Math.min(24, Math.max(1, Number(v) || 1)))}
              />
            </label>
          </div>
        )}
      </section>

      <section className="planner-work-panel">
        <div className="card planner-mode-card">
          <ModeSwitch
            activeTab={activeTab}
            onTabChange={setActiveTab}
            mode={mode}
            onModeChange={setMode}
            unassignedCount={unassignedCount}
            debtsCount={debts.length}
          />
        </div>

        <div className="card planner-content-card">
          {activeTab === 'debts' ? (
            <DebtsView items={debts} />
          ) : activeTab === 'recurring' ? (
            <RecurringView
              token={token}
              visibleRange={visibleGridRange}
              onPreviewChange={setRecurringMarkings}
              onManualHandlerChange={setManualDateHandler}
            />
          ) : activeTab === 'unassigned' ? (
            <UnassignedView token={token} onTasksChanged={notifyTasksChanged} />
          ) : mode === 'day' ? (
            <DayView
              token={token}
              date={selectedDate}
              onTasksChanged={notifyTasksChanged}
              gender={gender}
              onCycleChanged={notifyCycleChanged}
              showCare={careForSelectedDay}
            />
          ) : (
            <PeriodView
              token={token}
              range={periodRange}
              onRangeChange={setPeriodRange}
              onTasksChanged={notifyTasksChanged}
            />
          )}
        </div>
      </section>
    </div>
  )
}
