import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, getDocs, updateDoc, doc, Timestamp, orderBy, query, where, getCountFromServer } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import './AdminPage.css'
import { CURRENCY } from '../constants'

const BOUNTY_OPTIONS = [500, 1000, 2000, 3000, 5000]

function toDatetimeLocal(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function AdminPage() {
  const navigate = useNavigate()
  const isAdmin = useAuthStore((s) => s.isAdmin)

  const [tab, setTab] = useState('quizzes')
  const [showForm, setShowForm] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState(null) // null = 신규, object = 수정

  // 대시보드
  const [dashLoading, setDashLoading] = useState(false)
  const [dashData, setDashData] = useState(null)

  // 문제 폼
  const [isHtml, setIsHtml] = useState(false)
  const [hintsText, setHintsText] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [answerText, setAnswerText] = useState('')
  const [bounty, setBounty] = useState(1000)
  const [customBounty, setCustomBounty] = useState('')
  const [publishAt, setPublishAt] = useState('') // datetime-local string
  const [quizzes, setQuizzes] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // 상품권 관리
  const [giftCode, setGiftCode] = useState('')
  const [giftAmount, setGiftAmount] = useState('')
  const [giftCards, setGiftCards] = useState([
    { id: '1', code: 'CULTURE-1234-5678', amount: 10000, isUsed: false },
    { id: '2', code: 'CULTURE-9999-0000', amount: 5000, isUsed: true, usedBy: 'kakao_1234567890' },
  ])
  const [exchangeRequests] = useState([
    { id: '1', nickname: '테스트유저', amount: 10000, status: 'pending', requestedAt: '2026-04-07' },
  ])

  const handleTabChange = (t) => { setTab(t); setShowForm(false); setEditingQuiz(null) }

  const openCreate = () => {
    setEditingQuiz(null)
    setIsHtml(false)
    setHintsText('')
    setAnswerText('')
    setBounty(1000)
    setCustomBounty('')
    setPublishAt('')
    setShowPreview(false)
    setShowForm(true)
  }

  const openEdit = (q) => {
    setEditingQuiz(q)
    setIsHtml(q.isHtml ?? false)
    setHintsText((q.hints ?? []).join('\n'))
    setAnswerText((q.answers ?? [q.answer]).join(''))
    const b = q.bounty
    if (BOUNTY_OPTIONS.includes(b)) { setBounty(b); setCustomBounty('') }
    else { setBounty(1000); setCustomBounty(String(b)) }
    setPublishAt(toDatetimeLocal(q.publishAt))
    setShowPreview(false)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingQuiz(null) }

  const handleAddGiftCard = () => {
    if (!giftCode.trim() || !giftAmount) return
    setGiftCards([...giftCards, { id: Date.now().toString(), code: giftCode.trim(), amount: Number(giftAmount), isUsed: false }])
    setGiftCode('')
    setGiftAmount('')
    setShowForm(false)
  }

  useEffect(() => { if (!isAdmin) navigate('/') }, [isAdmin])
  useEffect(() => { if (tab === 'quizzes' && !showForm) fetchQuizzes() }, [tab, showForm])
  useEffect(() => { if (tab === 'dashboard') fetchDashboard() }, [tab])

  const POINT_TIERS = [2500, 5000, 10000, 20000]
  const GIFT_TIERS = [3000, 5000, 10000]

  const fetchDashboard = async () => {
    setDashLoading(true)
    try {
      if (!db) {
        // 개발용 목업
        const mockPoints = [3500, 6000, 12000, 4200, 8000]
        setDashData({
          userPoints: mockPoints,
          pendingCount: 1,
        })
        return
      }
      const [usersSnap, pendingSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('points', '>=', Math.min(...GIFT_TIERS)))),
        getCountFromServer(query(collection(db, 'exchanges'), where('status', '==', 'pending'))),
      ])
      setDashData({
        userPoints: usersSnap.docs.map((d) => d.data().points),
        pendingCount: pendingSnap.data().count,
      })
    } finally {
      setDashLoading(false)
    }
  }

  const handleModeToggle = (html) => { setIsHtml(html); setHintsText(''); setShowPreview(false) }

  const fetchQuizzes = async () => {
    if (!db) return
    const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    setQuizzes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }

  const getHintsArray = () => hintsText.split('\n').map((h) => h.trim()).filter(Boolean).slice(0, 5)
  const getAnswersArray = () => [answerText.trim()].filter(Boolean)
  const finalBounty = customBounty !== '' ? Number(customBounty) : bounty

  const handleSave = async () => {
    const validHints = getHintsArray()
    const validAnswers = getAnswersArray()
    if (validHints.length < 1 || validAnswers.length < 1) { alert('힌트와 정답을 입력하세요'); return }
    if (!finalBounty || finalBounty <= 0) { alert('현상금을 입력하세요'); return }

    const publishTimestamp = publishAt ? Timestamp.fromDate(new Date(publishAt)) : null

    setSubmitting(true)
    try {
      if (editingQuiz) {
        if (db) await updateDoc(doc(db, 'quizzes', editingQuiz.id), {
          hints: validHints,
          isHtml,
          answers: validAnswers,
          bounty: finalBounty,
          publishAt: publishTimestamp,
        })
        setQuizzes((prev) => prev.map((q) => q.id === editingQuiz.id
          ? { ...q, hints: validHints, isHtml, answers: validAnswers, bounty: finalBounty, publishAt: publishTimestamp }
          : q
        ))
        alert('수정되었습니다')
      } else {
        if (db) await addDoc(collection(db, 'quizzes'), {
          hints: validHints,
          isHtml,
          answers: validAnswers,
          bounty: finalBounty,
          challengers: 0,
          activePlayers: 0,
          solvedBy: null,
          publishAt: publishTimestamp,
          createdAt: Timestamp.now(),
        })
        alert('등록되었습니다')
      }
      closeForm()
    } finally {
      setSubmitting(false)
    }
  }

  const hintsArray = getHintsArray()

  const formatPublishAt = (ts) => {
    if (!ts) return null
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 공개`
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="back-btn" onClick={() => navigate(-1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h2>Admin</h2>
      </header>

      <div className="tab-bar">
        <button className={tab === 'quizzes' ? 'active' : ''} onClick={() => handleTabChange('quizzes')}>문제 관리</button>
        <button className={tab === 'gift' ? 'active' : ''} onClick={() => handleTabChange('gift')}>상품권 관리</button>
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => handleTabChange('dashboard')}>대시보드</button>
      </div>

      {/* 문제 관리 */}
      {tab === 'quizzes' && (
        showForm ? (
          <div className="create-tab">
            <button className="back-form-btn" onClick={closeForm}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> 목록으로</button>

            <div className="mode-toggle">
              <button className={`mode-btn ${!isHtml ? 'active' : ''}`} onClick={() => handleModeToggle(false)}>글자</button>
              <button className={`mode-btn ${isHtml ? 'active' : ''}`} onClick={() => handleModeToggle(true)}>HTML</button>
            </div>

            <section>
              <div className="label-row">
                <label>힌트 ({hintsArray.length}/5) · 엔터로 구분</label>
                {isHtml && (
                  <button className="preview-btn" onClick={() => setShowPreview((v) => !v)}>
                    {showPreview ? '편집' : '미리보기'}
                  </button>
                )}
              </div>
              {isHtml && showPreview ? (
                <div className="html-preview-list">
                  {hintsArray.length === 0
                    ? <p className="preview-empty">힌트 없음</p>
                    : hintsArray.map((h, i) => <div key={i} className="html-preview" dangerouslySetInnerHTML={{ __html: h }} />)
                  }
                </div>
              ) : (
                <textarea
                  className={`hints-textarea ${isHtml ? 'monospace' : ''}`}
                  value={hintsText}
                  onChange={(e) => setHintsText(e.target.value)}
                  placeholder={isHtml ? '<b>고라니</b>\n<span style="color:red">모음</span>\n비' : '고라니\n모음\n비'}
                  rows={6}
                />
              )}
            </section>

            <section>
              <label>정답</label>
              <input className="answer-field" value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="정확한 정답 입력" />
            </section>

            <section>
              <label>초기 현상금</label>
              <div className="bounty-options">
                {BOUNTY_OPTIONS.map((b) => (
                  <button key={b} className={`bounty-opt ${bounty === b && customBounty === '' ? 'selected' : ''}`}
                    onClick={() => { setBounty(b); setCustomBounty('') }}>
                    {b.toLocaleString()} {CURRENCY}
                  </button>
                ))}
              </div>
              <input className="answer-field" type="number" value={customBounty} onChange={(e) => setCustomBounty(e.target.value)} placeholder="직접 입력" min={1} />
              {customBounty !== '' && Number(customBounty) > 0 && (
                <p className="custom-bounty-preview">{Number(customBounty).toLocaleString()} {CURRENCY} 설정됨</p>
              )}
            </section>

            <section>
              <label>공개 예약 (선택)</label>
              <input
                className="answer-field"
                type="datetime-local"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
              />
              {!publishAt && <p className="publish-hint">비워두면 즉시 공개</p>}
            </section>

            <button className="submit-btn" onClick={handleSave} disabled={submitting}>
              {submitting ? '저장 중...' : editingQuiz ? '수정 완료' : '문제 등록'}
            </button>
          </div>
        ) : (
          <div className="quizzes-tab">
            <div className="tab-section-header">
              <span>문제 목록 ({quizzes.length})</span>
              <button className="add-btn" onClick={openCreate}>+</button>
            </div>
            {quizzes.map((q) => (
              <div key={q.id} className={`admin-quiz-card ${q.solvedBy ? 'solved' : ''}`}>
                <div className="admin-hints">
                  {q.hints.map((h, i) => (
                    <span key={i}>{q.isHtml ? <span dangerouslySetInnerHTML={{ __html: h }} /> : h}</span>
                  ))}
                  {q.isHtml && <span className="html-badge">HTML</span>}
                  {q.publishAt && !q.solvedBy && <span className="scheduled-badge">{formatPublishAt(q.publishAt)}</span>}
                </div>
                <div className="admin-quiz-meta">
                  <span>정답: <b>{(q.answers ?? [q.answer]).join(' / ')}</b></span>
                  <span>현상금: <b>{q.bounty.toLocaleString()} {CURRENCY}</b></span>
                  <span>도전자: <b>{q.challengers}명</b></span>
                  {q.solvedBy && <span className="solved-tag">종료 · {q.solvedBy}</span>}
                  {!q.solvedBy && <button className="edit-quiz-btn" onClick={() => openEdit(q)}>수정</button>}
                </div>
              </div>
            ))}
            {quizzes.length === 0 && <p className="empty-msg">등록된 문제가 없습니다</p>}
          </div>
        )
      )}

      {/* 상품권 관리 */}
      {tab === 'gift' && (
        showForm ? (
          <div className="gift-tab">
            <button className="back-form-btn" onClick={() => setShowForm(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> 목록으로</button>
            <section>
              <label>상품권 코드 등록</label>
              <div className="gift-input-row">
                <input className="answer-field" value={giftCode} onChange={(e) => setGiftCode(e.target.value)} placeholder="상품권 코드" />
                <input className="answer-field gift-amount" type="number" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} placeholder="금액" />
                <button className="gift-add-btn" onClick={handleAddGiftCard}>추가</button>
              </div>
            </section>
          </div>
        ) : (
          <div className="gift-tab">
            <div className="tab-section-header">
              <span>미발급 {giftCards.filter(g => !g.isUsed).length}개</span>
              <button className="add-btn" onClick={() => setShowForm(true)}>+</button>
            </div>
            <section>
              <label>등록된 코드</label>
              <div className="gift-list">
                {giftCards.map((g) => (
                  <div key={g.id} className={`gift-item ${g.isUsed ? 'used' : ''}`}>
                    <span className="gift-code">{g.code}</span>
                    <span className="gift-amount-tag">{g.amount.toLocaleString()}원</span>
                    <span className={`gift-status ${g.isUsed ? 'used' : 'available'}`}>
                      {g.isUsed ? '사용완료' : '미사용'}
                    </span>
                    <button
                      className={`gift-toggle-btn ${g.isUsed ? 'revert' : 'issue'}`}
                      onClick={() => setGiftCards((prev) => prev.map((c) => c.id === g.id ? { ...c, isUsed: !c.isUsed } : c))}
                    >
                      {g.isUsed ? '취소' : '사용완료'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <label>환전 신청</label>
              <div className="gift-list">
                {exchangeRequests.map((r) => (
                  <div key={r.id} className={`gift-item ${r.status === 'done' ? 'used' : ''}`}>
                    <span className="gift-code">{r.nickname}</span>
                    <span className="gift-amount-tag">{r.amount.toLocaleString()}원</span>
                    <span className="gift-date">{r.requestedAt}</span>
                    {r.status === 'pending'
                      ? <button className="gift-issue-btn">발급</button>
                      : <span className="gift-status used">완료</span>}
                  </div>
                ))}
                {exchangeRequests.length === 0 && <p className="empty-msg">신청 없음</p>}
              </div>
            </section>
          </div>
        )
      )}
      {/* 대시보드 */}
      {tab === 'dashboard' && (
        <div className="dashboard-tab">
          <div className="dash-section-header">
            <span>대시보드</span>
            <button className="preview-btn" onClick={fetchDashboard}>새로고침</button>
          </div>

          {dashLoading ? (
            <p className="empty-msg">불러오는 중...</p>
          ) : dashData ? (() => {
            const recommendations = GIFT_TIERS.map((t) => {
              const stock = giftCards.filter(g => g.amount === t && !g.isUsed).length
              const needed = dashData.userPoints.reduce((sum, p) => sum + Math.floor(p / t), 0)
              const toBuy = Math.max(0, needed - stock)
              return { amount: t, stock, needed, toBuy }
            })
            const totalAction = recommendations.filter(r => r.toBuy > 0).length
            return (
              <>
                {/* 준비 권장 */}
                <section>
                  <label>준비 권장</label>
                  <div className="dash-recommend-list">
                    {recommendations.map((r) => (
                      <div key={r.amount} className={`dash-recommend-item ${r.toBuy > 0 ? 'action' : 'ok'}`}>
                        <span className="dash-recommend-amount">{r.amount.toLocaleString()}원 카드</span>
                        <span className="dash-recommend-msg">
                          {r.toBuy > 0
                            ? `${r.toBuy}장 구매 필요`
                            : '충분'}
                        </span>
                        <span className="dash-recommend-detail">
                          재고 {r.stock}장 · 필요 {r.needed}장
                        </span>
                      </div>
                    ))}
                    {totalAction === 0 && (
                      <p className="dash-all-ok">현재 재고로 충분합니다</p>
                    )}
                  </div>
                </section>

                {/* 포인트 현황 */}
                <section>
                  <label>포인트 보유 현황</label>
                  <div className="dash-grid">
                    {POINT_TIERS.map((t) => {
                      const count = dashData.userPoints.filter(p => p >= t).length
                      return (
                        <div key={t} className={`dash-card ${count > 0 ? 'warning' : ''}`}>
                          <span className="dash-count">{count}명</span>
                          <span className="dash-label">{t.toLocaleString()} {CURRENCY} 이상</span>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* 환전 대기 */}
                {dashData.pendingCount > 0 && (
                  <section>
                    <div className={`dash-pending warning`}>
                      <span className="dash-count">{dashData.pendingCount}건</span>
                      <span className="dash-label">환전 신청 처리 대기 중</span>
                    </div>
                  </section>
                )}
              </>
            )
          })() : (
            <p className="empty-msg">새로고침을 눌러 불러오세요</p>
          )}
        </div>
      )}
    </div>
  )
}
