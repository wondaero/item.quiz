import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithCustomToken } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import './LoginPage.css'

const kakaoLogin = () => new Promise((resolve, reject) => {
  window.Kakao.Auth.login({
    throughTalk: false,
    success: resolve,
    fail: reject,
  })
})

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(import.meta.env.VITE_KAKAO_JS_KEY)
    }
  }, [])

  const handleKakaoLogin = async () => {
    try {
      const authResponse = await kakaoLogin()
      const accessToken = authResponse.access_token

      const ref = localStorage.getItem('qwiz_ref') ?? null

      const kakaoLoginFn = httpsCallable(functions, 'kakaoLogin')
      const { data } = await kakaoLoginFn({ accessToken, referredBy: ref })

      await signInWithCustomToken(auth, data.customToken)

      if (ref) localStorage.removeItem('qwiz_ref')

      setUser({ uid: data.uid, nickname: data.nickname, profileImage: data.profileImage })
      navigate('/quiz')
    } catch (err) {
      console.error('로그인 실패', err)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>로그인</h2>
        <p>카카오 계정으로 시작하세요</p>
        <button className="kakao-btn" onClick={handleKakaoLogin}>
          카카오로 시작하기
        </button>
      </div>
    </div>
  )
}
