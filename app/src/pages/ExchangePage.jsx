import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, addDoc, collection, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { CURRENCY } from '../constants'
import './ExchangePage.css'

const AMOUNT_OPTIONS = [3000, 5000, 10000]
const MIN_EXCHANGE = 3000

export default function ExchangePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [userData, setUserData] = useState(null)
  const [amount, setAmount] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!user || !db) return
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (snap.exists()) setUserData(snap.data())
    }
    fetch()
  }, [user])

  const handleExchange = async () => {
    const val = parseInt(amount)
    if (!val || val < MIN_EXCHANGE) {
      alert(`최소 ${MIN_EXCHANGE.toLocaleString()}${CURRENCY}부터 환전 가능합니다`)
      return
    }
    if (val > (userData?.points ?? 0)) {
      alert('보유 포인트가 부족합니다')
      return
    }
    if (db) {
      await addDoc(collection(db, 'exchanges'), {
        uid: user.uid,
        amount: val,
        status: 'pending',
        requestedAt: Timestamp.now(),
      })
    }
    setSubmitted(true)
  }

  return (
    <div className="exchange-page">
      <header className="exchange-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
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
            <p>• 최소 환전: {MIN_EXCHANGE.toLocaleString()} {CURRENCY}</p>
            <p>• 신청 후 관리자 확인을 통해 지급</p>
          </div>

          <div className="amount-options">
            {AMOUNT_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={`amount-opt ${amount === String(opt) ? 'selected' : ''}`}
                onClick={() => setAmount(String(opt))}
              >
                {opt.toLocaleString()}원
              </button>
            ))}
          </div>

          <div className="input-wrap">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="직접 입력"
            />
            <span className="input-unit">{CURRENCY}</span>
          </div>

          {amount && parseInt(amount) > 0 && (
            <p className="exchange-preview">= {parseInt(amount).toLocaleString()}원 상품권</p>
          )}

          <button className="btn-primary" onClick={handleExchange}>환전 신청</button>
        </div>
      )}
    </div>
  )
}
