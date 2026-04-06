import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import IntroPage from './pages/IntroPage'
import LoginPage from './pages/LoginPage'
import QuizListPage from './pages/QuizListPage'
import QuizDetailPage from './pages/QuizDetailPage'
import MyPage from './pages/MyPage'
import AdminPage from './pages/AdminPage'
import useAuthStore from './store/useAuthStore'

// TODO: 개발용 바이패스 - 배포 전 제거
function PrivateRoute({ children }) {
  return children
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
      </Routes>
    </BrowserRouter>
  )
}
