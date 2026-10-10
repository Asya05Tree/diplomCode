import { createContext, useContext, useMemo, useState } from 'react'
import uk from './uk.json'
import en from './en.json'

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

  const setLanguage = (lang) => {
    setLanguageState(lang)
    localStorage.setItem(LANGUAGE_KEY, lang)
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
    return { language, setLanguage, t }
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
