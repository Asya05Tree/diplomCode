import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { I18nProvider } from './i18n'
import Sidebar from './components/Sidebar'
import './Layout.css'
import Planner from './pages/Planner'
import QuickAddPage from './pages/QuickAddPage'
import ShoppingList from './pages/ShoppingList'
import Food from './pages/Food'
import Health from './pages/Health'
import Finance from './pages/Finance'
import Study from './pages/Study'
import Work from './pages/Work'
import Watchlist from './pages/Watchlist'
import Cycle from './pages/Cycle'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Legal from './pages/Legal'
import Footer from './components/Footer'
import HealthConsentGate from './components/HealthConsentGate'
import { getMe, logout } from './api/client'
import { getHealthProfile, setProfileStatus } from './api/healthProfile'
import { giveHealthConsent } from './api/account'
import {
  getPalette,
  getPaletteStyle,
  getThemeMode,
  setPalette as persistPalette,
  setPaletteStyle as persistPaletteStyle,
  setThemeMode as persistThemeMode,
} from './utils/settings'

const AUTH_TOKEN_KEY = 'authToken'

function Layout({ studentType, isWorking, gender, outletContext }) {
  const location = useLocation()
  return (
    <div className="app-shell">
      <Sidebar studentType={studentType} isWorking={isWorking} gender={gender} />
      <main className="app-main">
        <div className="app-content" key={location.pathname}>
          <Outlet context={outletContext} />
        </div>
        <Footer />
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
  // Статус навчання/роботи з профілю: керує видимістю розділу "Навчання" й режимом його сторінки
  const [studentType, setStudentType] = useState(null)
  const [isWorking, setIsWorking] = useState(false)
  // Стать з профілю: керує видимістю розділу "Менструальний цикл" (лише жіноча)
  const [gender, setGender] = useState(null)
  // Окрема явна згода на дані здоров'я/циклу (null — ще не давав; тоді модулі показують екран згоди)
  const [healthConsentAt, setHealthConsentAt] = useState(null)
  const navigate = useNavigate()

  // Довантажуємо статус навчання й стать з профілю (тихо — помилка не має ламати вхід)
  const loadStudyStatus = () =>
    getHealthProfile()
      .then((p) => {
        setStudentType(p?.studentType ?? null)
        setIsWorking(Boolean(p?.isWorking))
        setGender(p?.gender ?? null)
        setHealthConsentAt(p?.healthConsentAt ?? null)
      })
      .catch(() => {})

  // Дав згоду на здоров'я/цикл: зберігаємо на сервері й одразу відкриваємо модулі
  const handleHealthConsent = async () => {
    await giveHealthConsent()
    setHealthConsentAt(new Date().toISOString())
  }

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
        return loadStudyStatus()
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY)
      })
      .finally(() => setAuthChecked(true))
  }, [])

  const handleAuthed = ({ token, nickname, email }) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    setUser({ nickname, email })
    loadStudyStatus()
    navigate('/app')
  }

  // Зміна статусу в налаштуваннях: пишемо в профіль і одразу оновлюємо стан (sidebar/Study реагують)
  const handleSetStudyStatus = async ({ studentType: nextType, isWorking: nextWorking }) => {
    const type = nextType ?? studentType
    const working = nextWorking ?? isWorking
    setStudentType(type)
    setIsWorking(working)
    await setProfileStatus({ studentType: type, isWorking: working })
  }

  // Зміна статі в налаштуваннях: оновлюємо стан (sidebar/цикл реагують) і пишемо в профіль
  const handleSetGender = async (nextGender) => {
    setGender(nextGender)
    await setProfileStatus({ gender: nextGender })
  }

  const handleLogout = () => {
    // Спершу кажемо серверу відкликати токен (щоб копія токена не лишалась чинною), потім чистимо локально
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (token) logout(token)
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setUser(null)
    setStudentType(null)
    setIsWorking(false)
    setGender(null)
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
    user,
    onLogout: handleLogout,
    themeMode,
    onSetThemeMode: handleSetThemeMode,
    paletteStyle,
    onSetPaletteStyle: handleSetPaletteStyle,
    palette,
    onSetPalette: handleSetPalette,
    studentType,
    isWorking,
    onSetStudyStatus: handleSetStudyStatus,
    gender,
    onSetGender: handleSetGender,
  }

  return (
    <div
      className={`theme-${themeMode}`}
      data-style={paletteStyle}
      data-palette={palette}
      style={{ minHeight: '100vh' }}
    >
      <Routes>
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/app" replace />
            ) : (
              <Landing
                themeMode={themeMode}
                onSetThemeMode={handleSetThemeMode}
                palette={palette}
                onSetPalette={handleSetPalette}
              />
            )
          }
        />
        <Route
          path="/reg"
          element={user ? <Navigate to="/app" replace /> : <Register onRegistered={handleAuthed} />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/app" replace /> : <Login onLoggedIn={handleAuthed} />}
        />
        <Route
          path="/forgot"
          element={user ? <Navigate to="/app" replace /> : <ResetPassword />}
        />
        {/* Юридичні сторінки — публічні (доступні й до входу, і з футера застосунку) */}
        <Route path="/privacy" element={<Legal doc="privacy" themeMode={themeMode} onSetThemeMode={handleSetThemeMode} />} />
        <Route path="/terms" element={<Legal doc="terms" themeMode={themeMode} onSetThemeMode={handleSetThemeMode} />} />
        <Route
          path="/app"
          element={
            user ? (
              <Layout studentType={studentType} isWorking={isWorking} gender={gender} outletContext={settingsOutletContext} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        >
          <Route index element={<Planner />} />
          <Route path="quick-add" element={<QuickAddPage />} />
          <Route path="food" element={<Food />} />
          <Route path="health" element={<HealthConsentGate consented={!!healthConsentAt} onConsent={handleHealthConsent}><Health /></HealthConsentGate>} />
          <Route path="shopping-list" element={<ShoppingList />} />
          <Route path="finance" element={<Finance />} />
          <Route path="study" element={<Study />} />
          <Route path="work" element={isWorking ? <Work /> : <Navigate to="/app" replace />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="cycle" element={gender === 'female' ? <HealthConsentGate consented={!!healthConsentAt} onConsent={handleHealthConsent}><Cycle /></HealthConsentGate> : <Navigate to="/app" replace />} />
          <Route path="notes" element={<Notes />} />
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
