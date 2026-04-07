import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import IntroPage from './pages/IntroPage'
import LoginPage from './pages/LoginPage'
import QuizListPage from './pages/QuizListPage'
import QuizDetailPage from './pages/QuizDetailPage'
import MyPage from './pages/MyPage'
import AdminPage from './pages/AdminPage'
import ExchangePage from './pages/ExchangePage'
import useAuthStore from './store/useAuthStore'
import { DEV_ACCESS } from './constants'

function PrivateRoute({ children }) {
  const user = useAuthStore((s) => s.user)
  if (DEV_ACCESS.전체접근 || DEV_ACCESS.로그인) return children
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/quiz" element={<PrivateRoute><QuizListPage /></PrivateRoute>} />
        <Route path="/quiz/:id" element={<PrivateRoute><QuizDetailPage /></PrivateRoute>} />
        <Route path="/my" element={<PrivateRoute><MyPage /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
        <Route path="/exchange" element={<PrivateRoute><ExchangePage /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
