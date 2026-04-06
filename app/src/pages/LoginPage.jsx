import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  const handleKakaoLogin = () => {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(import.meta.env.VITE_KAKAO_JS_KEY)
    }

    window.Kakao.Auth.login({
      success: async () => {
        window.Kakao.API.request({
          url: '/v2/user/me',
          success: async (res) => {
            const uid = String(res.id)
            const nickname = res.kakao_account?.profile?.nickname || '익명'
            const profileImage = res.kakao_account?.profile?.profile_image_url || null

            const userRef = doc(db, 'users', uid)
            const userSnap = await getDoc(userRef)

            if (!userSnap.exists()) {
              await setDoc(userRef, {
                nickname,
                profileImage,
                points: 0,
                attempts: 0,
                freeTicketLastUsed: null,
              })
            }

            setUser({ uid, nickname, profileImage })
            navigate('/quiz')
          },
          fail: (err) => {
            console.error('카카오 사용자 정보 실패', err)
          },
        })
      },
      fail: (err) => {
        console.error('카카오 로그인 실패', err)
      },
    })
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
