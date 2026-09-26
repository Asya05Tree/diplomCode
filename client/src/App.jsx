import { useEffect, useState } from 'react'
import { I18nProvider, useI18n } from './i18n'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import { getMe } from './api/client'

const AUTH_TOKEN_KEY = 'authToken'

function AppContent() {
  const { t } = useI18n()
  const [theme, setTheme] = useState('light')
  // checking — ще перевіряємо localStorage/токен; далі landing/register/login/app
  const [view, setView] = useState('checking')
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) {
      setView('landing')
      return
    }
    // Сесія живе, поки користувач сам не натисне "Вийти" — тому при завантаженні
    // просто перевіряємо, що збережений токен ще дійсний, а не вимагаємо повторний вхід
    getMe(token)
      .then((me) => {
        setUser(me)
        setView('app')
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        setView('landing')
      })
  }, [])

  const handleAuthed = ({ token, nickname, email }) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    setUser({ nickname, email })
    setView('app')
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setUser(null)
    setView('landing')
  }

  return (
    <div className={`theme-${theme}`} style={{ minHeight: '100vh' }}>
      {view === 'checking' && null}

      {view === 'landing' && <Landing onNavigate={setView} />}

      {view === 'register' && (
        <Register onRegistered={handleAuthed} onBack={() => setView('landing')} />
      )}

      {view === 'login' && (
        <Login onLoggedIn={handleAuthed} onBack={() => setView('landing')} />
      )}

      {view === 'app' && (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <header
              style={{
                padding: '12px 24px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{user?.nickname} · {user?.email}</span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
                  {theme === 'light' ? '🌙' : '☀️'}
                </button>
                <button onClick={handleLogout}>{t('header.logout')}</button>
              </div>
            </header>
            <Dashboard />
          </main>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}
