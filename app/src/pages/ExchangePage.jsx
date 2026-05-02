import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { CURRENCY } from '../constants'
import PageLoading from '../components/PageLoading'
import './ExchangePage.css'

const AMOUNT_OPTIONS = [3000, 5000, 10000, 20000]

export default function ExchangePage() {
  const navigate = useNavigate()
  const userData = useAuthStore((s) => s.userData)
  const [stock, setStock] = useState({})
  const [amount, setAmount] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const getGiftStock = httpsCallable(functions, 'getGiftStock')
        const res = await getGiftStock()
        setStock(res.data ?? {})
      } catch {
        setStock({})
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const handleExchange = async () => {
    if (!amount) { alert('상품권을 선택하세요'); return }
    if (amount > (userData?.points ?? 0)) { alert('보유 포인트가 부족합니다'); return }
    setSubmitting(true)
    try {
      const requestExchange = httpsCallable(functions, 'requestExchange')
      await requestExchange({ amount })
      navigate('/vault', { replace: true })
    } catch (e) {
      const code = e?.details?.code ?? e?.message
      if (code === 'OUT_OF_STOCK' || e?.code === 'functions/unavailable') {
        alert('품절되었습니다. 재고 보충 후 다시 시도해주세요.')
      } else if (code === 'INSUFFICIENT_POINTS' || e?.code === 'functions/failed-precondition') {
        alert('포인트가 부족합니다.')
      } else {
        console.error('환전 오류', e)
        alert('오류가 발생했습니다. 다시 시도해주세요.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoading />

  return (
    <div className="exchange-page">
      <header className="exchange-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2>상점</h2>
      </header>

      <div className="exchange-form">
        <div className="points-display">
          <span className="points-label">보유 {CURRENCY}</span>
          <span className="points-value">{(userData?.points ?? 0).toLocaleString()} {CURRENCY}</span>
        </div>

        <div className="exchange-notice">
          <p>• 1 {CURRENCY} = 1원 (문화상품권 지급)</p>
          <p>• 교환 즉시 상품권 창고에서 코드 확인 가능</p>
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

        <button
          className="btn-primary"
          onClick={handleExchange}
          disabled={submitting || !amount || !(stock[amount] > 0)}
        >
          {submitting ? '처리 중...' : '교환하기'}
        </button>
      </div>
    </div>
  )
}
