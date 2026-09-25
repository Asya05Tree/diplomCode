import { useState } from 'react'
import { I18nProvider } from './i18n'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [theme, setTheme] = useState('light')

  return (
    <I18nProvider>
      <div className={`theme-${theme}`} style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <header style={{ padding: '12px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <button onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </header>
          <Dashboard />
        </main>
      </div>
    </I18nProvider>
  )
}
