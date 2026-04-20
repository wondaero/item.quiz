import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { db, auth } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { SIGNUP_REWARD } from '../constants'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(import.meta.env.VITE_KAKAO_JS_KEY)
    }
  }, [])

  const handleKakaoLogin = () => {
    window.Kakao.Auth.login({
      throughTalk: !import.meta.env.DEV,
      success: async () => {
        window.Kakao.API.request({
          url: '/v2/user/me',
          success: async (res) => {
            const kakaoId = String(res.id)
            const nickname = res.kakao_account?.profile?.nickname ?? '유저'
            const profileImage = res.kakao_account?.profile?.profile_image_url ?? null

            // Firebase Anonymous Auth로 Firestore 보안 규칙 적용
            const { user: firebaseUser } = await signInAnonymously(auth)
            const uid = firebaseUser.uid

            const userRef = doc(db, 'users', uid)
            const snap = await getDoc(userRef)
            if (!snap.exists()) {
              await setDoc(userRef, {
                kakaoId,
                nickname,
                profileImage,
                points: SIGNUP_REWARD,
                attempts: 0,
                freeTicketLastUsed: null,
                referredBy: null,
                joinedAt: Timestamp.now(),
                newbieBonusClaimed: false,
              })
            }

            setUser({ uid, kakaoId, nickname, profileImage })
            navigate('/quiz')
          },
          fail: (err) => console.error('카카오 사용자 정보 실패', err),
        })
      },
      fail: (err) => console.error('카카오 로그인 실패', err),
    })
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
