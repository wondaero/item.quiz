import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, addDoc, updateDoc, collection, Timestamp, increment, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { CURRENCY } from '../constants'
import './ExchangePage.css'

const AMOUNT_OPTIONS = [3000, 5000, 10000, 20000]

export default function ExchangePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [userData, setUserData] = useState(null)
  const [amount, setAmount] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user || !db) return
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (snap.exists()) setUserData(snap.data())
      setLoading(false)
    }
    fetch()
  }, [user])

  const handleExchange = async () => {
    if (!amount) { alert('상품권을 선택하세요'); return }
    if (amount > (userData?.points ?? 0)) { alert('보유 포인트가 부족합니다'); return }
    setSubmitting(true)
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await transaction.get(userRef)
        const currentPoints = userSnap.data()?.points ?? 0
        if (amount > currentPoints) throw new Error('INSUFFICIENT_POINTS')

        const exchangeRef = doc(collection(db, 'exchanges'))
        transaction.set(exchangeRef, {
          uid: user.uid,
          nickname: user.nickname ?? '유저',
          amount,
          status: 'pending',
          requestedAt: Timestamp.now(),
        })
        transaction.update(userRef, { points: increment(-amount) })
      })
      setSubmitted(true)
    } catch (e) {
      if (e.message === 'INSUFFICIENT_POINTS') alert('포인트가 부족합니다')
      else console.error('환전 신청 오류', e)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  return (
    <div className="exchange-page">
      <header className="exchange-header">
        <button className="back-btn" onClick={() => navigate(-1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h2>환전소</h2>
      </header>

      {submitted ? (
        <div className="exchange-success">
          <div className="success-icon">✅</div>
          <h3>환전 신청 완료</h3>
          <p>관리자 확인 후 상품권이 지급됩니다</p>
          <button className="btn-primary" onClick={() => navigate('/my')}>내 정보로</button>
        </div>
      ) : (
        <div className="exchange-form">
          <div className="points-display">
            <span className="points-label">보유 {CURRENCY}</span>
            <span className="points-value">{(userData?.points ?? 0).toLocaleString()} {CURRENCY}</span>
          </div>

          <div className="exchange-notice">
            <p>• 1 {CURRENCY} = 1원 (문화상품권 지급)</p>
            <p>• 신청 후 관리자 확인을 통해 지급</p>
          </div>

          <div className="amount-options">
            {AMOUNT_OPTIONS.map((opt) => {
              const affordable = opt <= (userData?.points ?? 0)
              return (
                <button
                  key={opt}
                  className={`amount-opt ${amount === opt ? 'selected' : ''} ${!affordable ? 'disabled' : ''}`}
                  onClick={() => affordable && setAmount(opt)}
                >
                  {opt.toLocaleString()}원
                </button>
              )
            })}
          </div>

          {amount && <p className="exchange-preview">{amount.toLocaleString()} {CURRENCY} → {amount.toLocaleString()}원 상품권</p>}

          <button className="btn-primary" onClick={handleExchange} disabled={submitting}>{submitting ? '신청 중...' : '환전 신청'}</button>
        </div>
      )}
    </div>
  )
}
