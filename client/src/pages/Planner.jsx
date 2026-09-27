import { useMemo, useState } from 'react'
import MonthGrid from '../components/planner/MonthGrid'
import ModeSwitch from '../components/planner/ModeSwitch'
import DayView from '../components/planner/DayView'
import PeriodView from '../components/planner/PeriodView'
import RecurringView from '../components/planner/RecurringView'
import { addDays, getMonthGridCells } from '../utils/date'
import './Planner.css'

const AUTH_TOKEN_KEY = 'authToken'

// Головний екран (planner-spec.md §4.2): ліва сітка — контекст, права частина — робоча область
// із трьома режимами (§4.3). Кожен режим сам відповідає за свої дані; сітка отримує лише готові
// markings (§4.4: заливка поточного режиму не змішується з іншою).
export default function Planner() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [mode, setMode] = useState('day')
  const [isRecurring, setIsRecurring] = useState(false)
  const [periodRange, setPeriodRange] = useState(() => {
    const from = new Date()
    return { from, to: addDays(from, 6) }
  })
  const [periodMarkings, setPeriodMarkings] = useState(new Map())
  const [recurringMarkings, setRecurringMarkings] = useState(new Map())
  // Тип Manual (RecurringView): клік по дню в лівій сітці = вставити/зняти ручну дату
  const [manualDateHandler, setManualDateHandler] = useState(null)

  const visibleGridRange = useMemo(() => {
    const cells = getMonthGridCells(visibleMonth.getFullYear(), visibleMonth.getMonth())
    return { from: cells[0].date, to: cells[cells.length - 1].date }
  }, [visibleMonth])

  const markings = isRecurring ? recurringMarkings : mode === 'period' ? periodMarkings : new Map()

  const handleSelectDate = (date) => {
    if (isRecurring) {
      if (manualDateHandler) manualDateHandler(date)
      return
    }
    if (mode !== 'day') return
    setSelectedDate(date)
  }

  return (
    <div className="planner">
      <section className="planner-grid-panel card">
        <MonthGrid
          visibleMonth={visibleMonth}
          onMonthChange={setVisibleMonth}
          selectedDate={mode === 'day' && !isRecurring ? selectedDate : null}
          onSelectDate={handleSelectDate}
          markings={markings}
        />
      </section>

      <section className="planner-work-panel">
        <div className="card planner-mode-card">
          <ModeSwitch mode={mode} onModeChange={setMode} isRecurring={isRecurring} onRecurringChange={setIsRecurring} />
        </div>

        <div className="card planner-content-card">
          {isRecurring ? (
            <RecurringView
              token={token}
              visibleRange={visibleGridRange}
              onPreviewChange={setRecurringMarkings}
              onManualHandlerChange={setManualDateHandler}
            />
          ) : mode === 'day' ? (
            <DayView token={token} date={selectedDate} />
          ) : (
            <PeriodView
              token={token}
              range={periodRange}
              onRangeChange={setPeriodRange}
              onMarkingsChange={setPeriodMarkings}
            />
          )}
        </div>
      </section>
    </div>
  )
}
