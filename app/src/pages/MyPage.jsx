import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { getToken } from 'firebase/messaging'
import { db, getMessagingInstance } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { CURRENCY, calcLevel, LEVEL_THRESHOLDS } from '../constants'
import PageLoading from '../components/PageLoading'
import './MyPage.css'

const initKakao = () => {
  if (!window.Kakao.isInitialized()) window.Kakao.init(import.meta.env.VITE_KAKAO_JS_KEY)
}

export default function MyPage() {
  const { user, isAdmin, logout } = useAuthStore()
  const userData = useAuthStore((s) => s.userData)
  const navigate = useNavigate()
  const loading = !userData
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const hasFreeTicket = userData?.freeTicketLastUsed !== today

  // 현재 알림 상태: fcmToken이 있으면 ON
  const notifOn = !!userData?.fcmToken

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user.uid)
    alert('추천 코드가 복사되었습니다')
  }

  const handleKakaoShare = () => {
    initKakao()
    const shareUrl = `${window.location.origin}?ref=${user.uid}`
    window.Kakao.Share.sendDefault({
      objectType: 'text',
      text: `[Qwiz] 친구가 초대했어요!\n연상 퀴즈로 현상금에 도전해보세요 🎯\n가입하면 500 ${CURRENCY} 지급!`,
      link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
    })
  }

  const handleNotifToggle = async () => {
    if (notifLoading) return
    setNotifLoading(true)
    try {
      if (notifOn) {
        // OFF: Firestore에서 토큰 제거
        await updateDoc(doc(db, 'users', user.uid), { fcmToken: null })
        localStorage.removeItem(`qwiz_fcm_${user.uid}`)
      } else {
        // ON: 권한 요청 + 토큰 저장
        if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) return
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          alert('브라우저 설정에서 알림을 허용해주세요.')
          return
        }
        const messaging = await getMessagingInstance()
        if (!messaging) return
        const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY })
        if (token) {
          await updateDoc(doc(db, 'users', user.uid), { fcmToken: token })
          localStorage.setItem(`qwiz_fcm_${user.uid}`, '1')
        }
      }
    } catch (e) {
      console.error('알림 설정 오류', e)
    } finally {
      setNotifLoading(false)
    }
  }

  if (loading) return <PageLoading />

  const level = calcLevel(userData?.attempts ?? 0, userData?.solvedCount ?? 0)
  const nextThreshold = LEVEL_THRESHOLDS.find(t => t.level === level + 1)
  const levelBonus = LEVEL_THRESHOLDS.find(t => t.level === level)?.bonus ?? 0

  return (
    <div className="my-page">
      <header className="my-header">
        <button className="back-btn" onClick={() => navigate(-1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h2>내 정보</h2>
      </header>

      <div className="my-profile">
        <div className="avatar">{user?.nickname?.[0] ?? '?'}</div>
        <p className="username">{user?.nickname ?? '유저'}</p>
        <div className="level-badge">Lv.{level}{levelBonus > 0 && <span className="level-bonus"> +{(levelBonus * 100).toFixed(0)}%</span>}</div>
        {nextThreshold && (
          <p className="level-next">다음 레벨: 도전 {nextThreshold.attempts}회 또는 정답 {nextThreshold.solved}회</p>
        )}
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
          <span className="referral-code">{user?.uid}</span>
          <button className="referral-copy-btn" onClick={handleCopyCode}>복사</button>
        </div>
        <button className="referral-share-btn" onClick={handleKakaoShare}>카카오로 친구 초대</button>
        <p className="referral-desc">친구가 가입하면 첫 정답 시 {CURRENCY} 보너스 · 이후 영구 수익 1% 쉐어</p>
      </div>

      <div className="notif-section">
        <span className="notif-label">새 퀴즈 알림</span>
        <button
          className={`notif-toggle ${notifOn ? 'on' : 'off'}`}
          onClick={handleNotifToggle}
          disabled={notifLoading}
        >
          <span className="notif-thumb" />
        </button>
      </div>

      <div className="my-actions">
        {isAdmin && (
          <button className="action-btn admin" onClick={() => navigate('/admin')}>Admin 페이지</button>
        )}
        <button className="action-btn" onClick={() => navigate('/vault')}>상품권 창고</button>
        <button className="action-btn logout" onClick={() => setShowLogoutConfirm(true)}>로그아웃</button>
      </div>

      {showLogoutConfirm && (
        <div className="confirm-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-title">로그아웃</p>
            <p className="confirm-desc">정말 로그아웃 하시겠어요?</p>
            <div className="confirm-btns">
              <button className="confirm-cancel" onClick={() => setShowLogoutConfirm(false)}>취소</button>
              <button className="confirm-ok" onClick={handleLogout}>로그아웃</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
