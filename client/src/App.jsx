import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { I18nProvider } from './i18n'
import Sidebar from './components/Sidebar'
import './Layout.css'
import Planner from './pages/Planner'
import ShoppingList from './pages/ShoppingList'
import Food from './pages/Food'
import Health from './pages/Health'
import Finance from './pages/Finance'
import Cycle from './pages/Cycle'
import Settings from './pages/Settings'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import { getMe } from './api/client'
import {
  getPalette,
  getPaletteStyle,
  getThemeMode,
  setPalette as persistPalette,
  setPaletteStyle as persistPaletteStyle,
  setThemeMode as persistThemeMode,
} from './utils/settings'

const AUTH_TOKEN_KEY = 'authToken'

function Layout({ user, outletContext }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <header className="app-header">
          <span className="app-header-user">{user?.nickname} · {user?.email}</span>
        </header>
        <Outlet context={outletContext} />
      </main>
    </div>
  )
}

function AppContent() {
  // Тема/стиль/палітра читаються з localStorage одразу при створенні стейту (а не в useEffect),
  // інакше перший кадр малюється дефолтом і сторінка блимає перед застосуванням збереженого вигляду.
  const [themeMode, setThemeMode] = useState(getThemeMode)
  const [paletteStyle, setPaletteStyle] = useState(getPaletteStyle)
  const [palette, setPalette] = useState(getPalette)
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

  const handleSetThemeMode = (mode) => {
    setThemeMode(mode)
    persistThemeMode(mode)
  }

  const handleSetPaletteStyle = (style) => {
    setPaletteStyle(style)
    persistPaletteStyle(style)
  }

  const handleSetPalette = (value) => {
    setPalette(value)
    persistPalette(value)
  }

  if (!authChecked) return null

  const settingsOutletContext = {
    onLogout: handleLogout,
    themeMode,
    onSetThemeMode: handleSetThemeMode,
    paletteStyle,
    onSetPaletteStyle: handleSetPaletteStyle,
    palette,
    onSetPalette: handleSetPalette,
  }

  return (
    <div
      className={`theme-${themeMode}`}
      data-style={paletteStyle}
      data-palette={palette}
      style={{ minHeight: '100vh' }}
    >
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
              <Layout user={user} outletContext={settingsOutletContext} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        >
          <Route index element={<Planner />} />
          <Route path="food" element={<Food />} />
          <Route path="health" element={<Health />} />
          <Route path="shopping-list" element={<ShoppingList />} />
          <Route path="finance" element={<Finance />} />
          <Route path="cycle" element={<Cycle />} />
          <Route path="settings" element={<Settings />} />
        </Route>
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
