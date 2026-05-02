import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { CURRENCY } from '../constants'
import PageLoading from '../components/PageLoading'
import './VaultPage.css'

export default function VaultPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [exchanges, setExchanges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid || !db) return
    const unsub = onSnapshot(
      query(
        collection(db, 'exchanges'),
        where('uid', '==', user.uid),
        orderBy('requestedAt', 'desc')
      ),
      (snap) => {
        setExchanges(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [user?.uid])

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code)
    alert('코드가 복사되었습니다')
  }

  const formatDate = (ts) => {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  if (loading) return <PageLoading />

  return (
    <div className="vault-page">
      <header className="vault-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2>상품권 창고</h2>
      </header>

      <button className="vault-shop-btn" onClick={() => navigate('/exchange')}>
        상점 가기 →
      </button>

      {exchanges.length === 0 ? (
        <p className="vault-empty">아직 교환한 상품권이 없어요</p>
      ) : (
        <div className="vault-list">
          {exchanges.map((ex) => (
            <div key={ex.id} className="vault-card">
              <div className="vault-card-top">
                <span className="vault-amount">{ex.amount.toLocaleString()}원 상품권</span>
                <span className="vault-date">{formatDate(ex.requestedAt)}</span>
              </div>
              <div className="vault-code-row">
                <span className="vault-code">{ex.code}</span>
                <button className="vault-copy-btn" onClick={() => handleCopyCode(ex.code)}>복사</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
