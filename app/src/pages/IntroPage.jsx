import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
// import logo from '../assets/logo1.png'
import introBg from '../assets/intro-bg.png'
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
    <div className="intro-page" style={{ backgroundImage: `url(${introBg})` }}>
      <div className="intro-logo">
        <h1>
          {/* <img src={logo} alt="Qwiz" className="intro-logo-img" /> */}
          Qwiz
        </h1>
        <p>돈 버는 앱, 돈 되는 문제</p>
      </div>
      <div className="intro-buttons">
        <button className="btn-primary" onClick={handleStart}>시작하기</button>
        <button className="btn-secondary" onClick={() => navigate('/settings')}>설정</button>
        <button className="btn-ghost" onClick={() => window.close()}>종료</button>
      </div>
    </div>
  )
}
