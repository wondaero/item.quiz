import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  const handleKakaoLogin = () => {
    // TODO: 개발용 바이패스 - 실제 카카오 로그인으로 교체
    setUser({ uid: import.meta.env.VITE_ADMIN_UID ?? 'dev-admin', nickname: '테스트유저', profileImage: null })
    navigate('/quiz')
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>로그인</h2>
        <p>카카오 계정으로 시작하세요</p>
        <button className="kakao-btn" onClick={handleKakaoLogin}>
          <img src="/kakao-icon.svg" alt="kakao" />
          카카오로 시작하기
        </button>
      </div>
    </div>
  )
}
