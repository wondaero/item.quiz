import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import { APP_NAME } from '../constants'
import './IntroPage.css'

export default function IntroPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const handleStart = () => {
    if (user) {
      navigate('/quiz')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="intro-page">
      <div className="intro-logo">
        <h1>{APP_NAME}</h1>
        <p>단어를 연결해 정답을 찾아라</p>
      </div>
      <div className="intro-buttons">
        <button className="btn-primary" onClick={handleStart}>시작하기</button>
        <button className="btn-secondary" onClick={() => navigate('/settings')}>설정</button>
        <button className="btn-ghost" onClick={() => window.close()}>종료</button>
      </div>
    </div>
  )
}
