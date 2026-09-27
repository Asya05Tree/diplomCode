import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
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
  // Поки не перевірили збережений токен — нічого не рендеримо, щоб не мигнути landing перед /app
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) {
      setAuthChecked(true)
      return
    }
    // Сесія живе, поки користувач сам не натисне "Вийти" — тому при завантаженні
    // просто перевіряємо, що збережений токен ще дійсний, а не вимагаємо повторний вхід
    getMe(token)
      .then((me) => {
        setUser(me)
        setAuthChecked(true)
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        setAuthChecked(true)
      })
  }, [])

  const handleAuthed = ({ token, nickname, email }) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    setUser({ nickname, email })
    navigate('/app')
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setUser(null)
    navigate('/')
  }

  if (!authChecked) return null

  return (
    <div className={`theme-${theme}`} style={{ minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/app" replace /> : <Landing />} />
        <Route
          path="/reg"
          element={user ? <Navigate to="/app" replace /> : <Register onRegistered={handleAuthed} />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/app" replace /> : <Login onLoggedIn={handleAuthed} />}
        />
        <Route
          path="/app"
          element={
            user ? (
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
                      <button onClick={() => setTheme((th) => (th === 'light' ? 'dark' : 'light'))}>
                        {theme === 'light' ? '🌙' : '☀️'}
                      </button>
                      <button onClick={handleLogout}>{t('header.logout')}</button>
                    </div>
                  </header>
                  <Dashboard />
                </main>
              </div>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </I18nProvider>
  )
}
