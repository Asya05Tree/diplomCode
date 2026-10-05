import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import MonthGrid from '../components/planner/MonthGrid'
import ModeSwitch from '../components/planner/ModeSwitch'
import DayView from '../components/planner/DayView'
import PeriodView from '../components/planner/PeriodView'
import RecurringView from '../components/planner/RecurringView'
import UnassignedView from '../components/planner/UnassignedView'
import { getFreeDays, getPeriodTasks, getUnassignedCount } from '../api/tasks'
import { addDays, getMonthGridCells } from '../utils/date'
import './Planner.css'

const AUTH_TOKEN_KEY = 'authToken'

// Головний екран (planner-spec.md §4.2): ліва сітка — контекст, права частина — робоча область
// із трьома режимами (§4.3). Базове відображення сітки (§4.4) — дні із задачами або з недостатнім
// запасом вільного часу підсвічені кольором, порожні дні без заливки; працює завжди, без перемикача.
export default function Planner() {
  const { t } = useI18n()
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
  // Тип Manual (RecurringView): клік по дню в лівій сітці = вставити/зняти ручну дату
  const [manualDateHandler, setManualDateHandler] = useState(null)
  // Бампається після будь-якої зміни задач у Дні/Періоді/Нерозподілених, щоб заливка сітки
  // й лічильник на вкладці "Нерозподілені" не застарівали
  const [tasksVersion, setTasksVersion] = useState(0)
  const notifyTasksChanged = () => setTasksVersion((v) => v + 1)

  const visibleGridRange = useMemo(() => {
    const cells = getMonthGridCells(visibleMonth.getFullYear(), visibleMonth.getMonth())
    return { from: cells[0].date, to: cells[cells.length - 1].date }
  }, [visibleMonth])

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

  // Лічильник на вкладці "Нерозподілені" (раніше показувався в сайдбарі) — оновлюється
  // після будь-якої зміни задач, незалежно від того, яка вкладка зараз активна
  useEffect(() => {
    getUnassignedCount(token)
      .then((res) => setUnassignedCount(res.count))
      .catch(() => {})
  }, [token, tasksVersion])

  const markings = activeTab === 'recurring' ? recurringMarkings : busyMarkings

  const handleSelectDate = (date) => {
    if (activeTab === 'recurring') {
      if (manualDateHandler) manualDateHandler(date)
      return
    }
    if (activeTab !== 'dayPeriod' || mode !== 'day') return
    setSelectedDate(date)
  }

  return (
    <div className="planner">
      <section className="planner-grid-panel card">
        <MonthGrid
          visibleMonth={visibleMonth}
          onMonthChange={setVisibleMonth}
          selectedDate={activeTab === 'dayPeriod' && mode === 'day' ? selectedDate : null}
          onSelectDate={handleSelectDate}
          markings={markings}
        />

        {activeTab === 'dayPeriod' && (
          <div className="planner-free-hours">
            <label>
              {t('planner.minFreeHours')}
              <input
                type="number"
                min="1"
                max="24"
                value={minFreeHours}
                onChange={(e) => setMinFreeHours(Math.min(24, Math.max(1, Number(e.target.value) || 1)))}
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
          />
        </div>

        <div className="card planner-content-card">
          {activeTab === 'recurring' ? (
            <RecurringView
              token={token}
              visibleRange={visibleGridRange}
              onPreviewChange={setRecurringMarkings}
              onManualHandlerChange={setManualDateHandler}
            />
          ) : activeTab === 'unassigned' ? (
            <UnassignedView token={token} onTasksChanged={notifyTasksChanged} />
          ) : mode === 'day' ? (
            <DayView token={token} date={selectedDate} onTasksChanged={notifyTasksChanged} />
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
