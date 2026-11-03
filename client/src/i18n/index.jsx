import { createContext, useContext, useMemo, useState } from 'react'
import uk from './uk.json'
import en from './en.json'
import { orderedWeekDays as computeOrderedWeekDays, formatDateFor } from '../utils/date'
import {
  getWeekStart,
  setWeekStart as persistWeekStart,
  getDateFormat,
  setDateFormat as persistDateFormat,
} from '../utils/settings'

const dictionaries = { uk, en }
const LANGUAGE_KEY = 'settings:language'

const I18nContext = createContext(null)

function getStoredLanguage() {
  const stored = localStorage.getItem(LANGUAGE_KEY)
  // Українська — мова за замовчуванням (coding-guide.md §3)
  return stored in dictionaries ? stored : 'uk'
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(getStoredLanguage)
  // Глобальні календарні налаштування (planner-spec.md §4.10): перший день тижня і формат дати.
  // Живуть тут разом із мовою, бо це теж загальнопроєктні параметри показу — компоненти беруть
  // уже готові похідні (weekdays/orderedWeekDays/formatDate) через useI18n без прокидання пропів.
  const [weekStart, setWeekStartState] = useState(getWeekStart)
  const [dateFormat, setDateFormatState] = useState(getDateFormat)

  const setLanguage = (lang) => {
    setLanguageState(lang)
    localStorage.setItem(LANGUAGE_KEY, lang)
  }

  const setWeekStart = (n) => {
    setWeekStartState(n)
    persistWeekStart(n)
  }

  const setDateFormat = (format) => {
    setDateFormatState(format)
    persistDateFormat(format)
  }

  const value = useMemo(() => {
    const dict = dictionaries[language]
    const t = (key, params) => {
      let text = dict[key] ?? key
      if (params) {
        for (const [name, val] of Object.entries(params)) {
          text = text.replace(`{${name}}`, val)
        }
      }
      return text
    }
    // Базові короткі назви в ISO-порядку (Пн..Нд) — для пошуку за номером дня (label[d-1]).
    const weekdaysIso = t('planner.weekdaysShort').split(',')
    // ISO-номери днів у порядку показу + відповідні назви (для сіток і заголовків календарів).
    const orderedWeekDays = computeOrderedWeekDays(weekStart)
    const weekdays = orderedWeekDays.map((d) => weekdaysIso[d - 1])
    const formatDate = (dateValue) => formatDateFor(dateValue, dateFormat)
    return {
      language,
      setLanguage,
      t,
      weekStart,
      setWeekStart,
      dateFormat,
      setDateFormat,
      weekdaysIso,
      weekdays,
      orderedWeekDays,
      formatDate,
    }
  }, [language, weekStart, dateFormat])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
