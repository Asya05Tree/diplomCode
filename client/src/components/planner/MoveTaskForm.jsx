import { useState } from 'react'
import { useI18n } from '../../i18n'
import { toApiDate, toApiDateTime, formatTime } from '../../utils/date'
import './MoveTaskForm.css'

// Компактний інлайн-редактор дати/часу — спільний для дії "Перенести" в Дні/Періоді/Нерозподілених.
export default function MoveTaskForm({ initialDate, onConfirm, onCancel }) {
  const { t } = useI18n()
  const [date, setDate] = useState(toApiDate(initialDate))
  const [time, setTime] = useState(formatTime(initialDate))

  const handleConfirm = () => {
    const [y, m, d] = date.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)
    onConfirm(toApiDateTime(new Date(y, m - 1, d, h, min)))
  }

  return (
    <div className="move-task-form">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      <button type="button" onClick={handleConfirm}>{t('unassigned.moveConfirm')}</button>
      <button type="button" onClick={onCancel}>{t('unassigned.moveCancel')}</button>
    </div>
  )
}
