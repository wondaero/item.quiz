import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { db, auth } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { SIGNUP_REWARD } from '../constants'
import './LoginPage.css'

const kakaoLogin = () => new Promise((resolve, reject) => {
  window.Kakao.Auth.login({
    throughTalk: !import.meta.env.DEV,
    success: resolve,
    fail: reject,
  })
})

const kakaoGetProfile = () => new Promise((resolve, reject) => {
  window.Kakao.API.request({ url: '/v2/user/me', success: resolve, fail: reject })
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
      await kakaoLogin()
      const res = await kakaoGetProfile()

      const kakaoId = String(res.id)
      const nickname = res.kakao_account?.profile?.nickname ?? '유저'
      const profileImage = res.kakao_account?.profile?.profile_image_url ?? null

      const { user: firebaseUser } = await signInAnonymously(auth)
      const uid = firebaseUser.uid

      const userRef = doc(db, 'users', uid)
      const snap = await getDoc(userRef)
      if (!snap.exists()) {
        const ref = localStorage.getItem('qwiz_ref') ?? null
        await setDoc(userRef, {
          kakaoId,
          nickname,
          profileImage,
          points: SIGNUP_REWARD,
          attempts: 0,
          freeTicketLastUsed: null,
          referredBy: ref,
          joinedAt: Timestamp.now(),
          newbieBonusClaimed: false,
        })
        if (ref) localStorage.removeItem('qwiz_ref')
      }

      setUser({ uid, kakaoId, nickname, profileImage })
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