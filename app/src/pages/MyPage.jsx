import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { CURRENCY } from '../constants'
import './MyPage.css'

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

  return (
    <div className="my-page">
      <header className="my-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
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

      <div className="my-actions">
{isAdmin && (
          <button className="action-btn admin" onClick={() => navigate('/admin')}>Admin 페이지</button>
        )}
        <button className="action-btn logout" onClick={handleLogout}>로그아웃</button>
      </div>
    </div>
  )
}
