import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, addDoc, getDocs, collection, query, where, Timestamp, increment, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { CURRENCY } from '../constants'
import PageLoading from '../components/PageLoading'
import './ExchangePage.css'

const AMOUNT_OPTIONS = [3000, 5000, 10000, 20000]

export default function ExchangePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const userData = useAuthStore((s) => s.userData)
  const [stock, setStock] = useState({})
  const [amount, setAmount] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [submittedType, setSubmittedType] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user || !db) return
    const fetch = async () => {
      const giftSnap = await getDocs(query(collection(db, 'giftCards'), where('isUsed', '==', false)))
      const counts = {}
      giftSnap.docs.forEach((d) => {
        const amt = d.data().amount
        counts[amt] = (counts[amt] ?? 0) + 1
      })
      setStock(counts)
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
      setSubmittedType('exchange')
      setSubmitted(true)
    } catch (e) {
      if (e.message === 'INSUFFICIENT_POINTS') alert('포인트가 부족합니다')
      else console.error('환전 신청 오류', e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStockRequest = async () => {
    if (!amount) { alert('상품권을 선택하세요'); return }
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'adminAlerts'), {
        type: 'stock_request',
        amount,
        uid: user.uid,
        nickname: user.nickname ?? '유저',
        createdAt: Timestamp.now(),
      })
      setSubmittedType('request')
      setSubmitted(true)
    } catch (e) {
      console.error('재고 신청 오류', e)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoading />

  return (
    <div className="exchange-page">
      <header className="exchange-header">
        <button className="back-btn" onClick={() => navigate(-1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h2>환전소</h2>
      </header>

      {submitted ? (
        <div className="exchange-success">
          <div className="success-icon">{submittedType === 'request' ? '🔔' : '✅'}</div>
          <h3>{submittedType === 'request' ? '신청 완료' : '환전 신청 완료'}</h3>
          <p>{submittedType === 'request' ? '확인 후 빠르게 처리해 드릴게요.' : '관리자 확인 후 상품권이 지급됩니다'}</p>
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
              const hasStock = (stock[opt] ?? 0) > 0
              return (
                <button
                  key={opt}
                  className={`amount-opt ${amount === opt ? 'selected' : ''} ${!affordable ? 'disabled' : ''}`}
                  onClick={() => affordable && setAmount(opt)}
                >
                  <span>{opt.toLocaleString()}원</span>
                  <span className={`stock-badge ${!hasStock ? 'out' : ''}`}>
                    {hasStock ? `${stock[opt]}장` : '품절'}
                  </span>
                </button>
              )
            })}
          </div>

          {amount && (
            <p className="exchange-preview">
              {amount.toLocaleString()} {CURRENCY} → {amount.toLocaleString()}원 상품권
              {!(stock[amount] > 0) && ' · 현재 품절'}
            </p>
          )}

          {amount && !(stock[amount] > 0) ? (
            amount <= (userData?.points ?? 0) ? (
              <button className="btn-primary btn-request" onClick={handleStockRequest} disabled={submitting}>
                {submitting ? '신청 중...' : '품절 신청'}
              </button>
            ) : (
              <button className="btn-primary" disabled>포인트 부족</button>
            )
          ) : (
            <button className="btn-primary" onClick={handleExchange} disabled={submitting || !amount}>
              {submitting ? '신청 중...' : '환전 신청'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
