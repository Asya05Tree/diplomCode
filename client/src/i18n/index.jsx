import { createContext, useContext, useMemo, useState } from 'react'
import uk from './uk.json'
import en from './en.json'

const dictionaries = { uk, en }

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  // Українська — мова за замовчуванням (coding-guide.md §3)
  const [language, setLanguage] = useState('uk')

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
