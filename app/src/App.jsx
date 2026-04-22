import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/useAuthStore'
import { DEV_ACCESS } from './constants'

const IntroPage = lazy(() => import('./pages/IntroPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const QuizListPage = lazy(() => import('./pages/QuizListPage'))
const QuizDetailPage = lazy(() => import('./pages/QuizDetailPage'))
const MyPage = lazy(() => import('./pages/MyPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const ExchangePage = lazy(() => import('./pages/ExchangePage'))

function PrivateRoute({ children }) {
  const user = useAuthStore((s) => s.user)
  if (DEV_ACCESS.전체접근 || DEV_ACCESS.로그인) return children
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) localStorage.setItem('qwiz_ref', ref)
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<IntroPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/quiz" element={<PrivateRoute><QuizListPage /></PrivateRoute>} />
          <Route path="/quiz/:id" element={<PrivateRoute><QuizDetailPage /></PrivateRoute>} />
          <Route path="/my" element={<PrivateRoute><MyPage /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
          <Route path="/exchange" element={<PrivateRoute><ExchangePage /></PrivateRoute>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
