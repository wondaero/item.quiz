import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { CURRENCY } from '../constants'
import './MyPage.css'

const initKakao = () => {
  if (!window.Kakao.isInitialized()) window.Kakao.init(import.meta.env.VITE_KAKAO_JS_KEY)
}

export default function MyPage() {
  const { user, isAdmin, logout } = useAuthStore()
  const navigate = useNavigate()
  const [userData, setUserData] = useState(null)

  useEffect(() => {
    if (!user || !db) return
    const fetchUser = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (snap.exists()) setUserData(snap.data())
    }
    fetchUser()
  }, [user])

  const today = new Date().toISOString().slice(0, 10)
  const hasFreeTicket = userData?.freeTicketLastUsed !== today

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user.kakaoId)
    alert('추천 코드가 복사되었습니다')
  }

  const handleKakaoShare = () => {
    initKakao()
    const shareUrl = `${window.location.origin}?ref=${user.kakaoId}`
    window.Kakao.Share.sendDefault({
      objectType: 'text',
      text: `[Qwiz] 친구가 초대했어요!\n연상 퀴즈로 현상금에 도전해보세요 🎯\n가입하면 500 ${CURRENCY} 지급!`,
      link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
    })
  }

  return (
    <div className="my-page">
      <header className="my-header">
        <button className="back-btn" onClick={() => navigate(-1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h2>내 정보</h2>
      </header>

      <div className="my-profile">
        <div className="avatar">{user?.nickname?.[0] ?? '?'}</div>
        <p className="username">{user?.nickname ?? '유저'}</p>
      </div>

      <div className="my-stats">
        <div className="stat-card">
          <span className="stat-value">{userData?.points ?? 0}</span>
          <span className="stat-label">보유 {CURRENCY}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{userData?.attempts ?? 0}</span>
          <span className="stat-label">총 도전 횟수</span>
        </div>
        <div className={`stat-card ticket-card-stat ${hasFreeTicket ? 'available' : ''}`}>
          <span className="stat-value ticket-icon">{hasFreeTicket ? '🎟️' : '✗'}</span>
          <span className="stat-label">무료 참가권</span>
          <span className="ticket-status">{hasFreeTicket ? '사용 가능' : '내일 갱신'}</span>
        </div>
      </div>

      <div className="referral-section">
        <p className="referral-label">내 추천 코드</p>
        <div className="referral-row">
          <span className="referral-code">{user?.kakaoId}</span>
          <button className="referral-copy-btn" onClick={handleCopyCode}>복사</button>
        </div>
        <button className="referral-share-btn" onClick={handleKakaoShare}>카카오로 친구 초대</button>
        <p className="referral-desc">친구가 가입하면 첫 정답 시 {CURRENCY} 보너스 · 이후 영구 수익 1% 쉐어</p>
      </div>

      <div className="my-actions">
        {isAdmin && (
          <button className="action-btn admin" onClick={() => navigate('/admin')}>Admin 페이지</button>
        )}
        <button className="action-btn" onClick={() => navigate('/exchange')}>상점 · 환전</button>
        <button className="action-btn logout" onClick={handleLogout}>로그아웃</button>
      </div>
    </div>
  )
}
