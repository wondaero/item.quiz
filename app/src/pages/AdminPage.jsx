import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, Timestamp, orderBy, query, where, onSnapshot, limit, startAfter } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import './AdminPage.css'
import { CURRENCY } from '../constants'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import { HiArrowPath } from 'react-icons/hi2'

function fmtNum(n) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억`
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(1)}만`
  return (n >= 0 ? '+' : '') + n.toLocaleString()
}

const BOUNTY_OPTIONS = [500, 1000, 2000, 3000, 5000]
const POINT_TIERS = [2500, 5000, 10000, 20000]
const GIFT_TIERS = [5000, 10000, 20000]

function toDatetimeLocal(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const ChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

const extractPreviewHint = (hints, isHtml) => {
  if (!hints.length) return ''
  const first = hints[0]
  const stripped = isHtml ? first.replace(/<[^>]+>/g, '').trim() : first
  return stripped.replace(/^[\d]+[.)]\s*/, '').trim()
}

function HintsPreview({ hints, isHtml }) {
  if (hints.length === 0) return <p className="preview-empty">힌트 없음</p>
  return isHtml
    ? <p className="admin-hints-text" dangerouslySetInnerHTML={{ __html: hints.join('<br/>') }} />
    : <p className="admin-hints-text">{hints.join('\n')}</p>
}

export default function AdminPage() {
  const navigate = useNavigate()
  const isAdmin = useAuthStore((s) => s.isAdmin)

  const [tab, setTab] = useState('quizzes')
  const [showForm, setShowForm] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState(null)

  const [dashLoading, setDashLoading] = useState(false)
  const [dashData, setDashData] = useState(null)

  const [chartRange, setChartRange] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [pnlExpanded, setPnlExpanded] = useState(false)

  const [isHtml, setIsHtml] = useState(false)
  const [hintsText, setHintsText] = useState('')
  const [showHtmlPreview, setShowHtmlPreview] = useState(false)
  const [showQuizPreview, setShowQuizPreview] = useState(false)
  const [answers, setAnswers] = useState([''])
  const [previewHint, setPreviewHint] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [bounty, setBounty] = useState(1000)
  const [customBounty, setCustomBounty] = useState('')
  const [publishAt, setPublishAt] = useState('')
  const [quizzes, setQuizzes] = useState([])
  const [quizLastDoc, setQuizLastDoc] = useState(null)
  const [quizHasMore, setQuizHasMore] = useState(false)
  const [quizLoadingMore, setQuizLoadingMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [giftCode, setGiftCode] = useState('')
  const [giftAmount, setGiftAmount] = useState('5000')
  const [giftCards, setGiftCards] = useState([])
  const [exchangeRequests, setExchangeRequests] = useState([])
  const [giftLoading, setGiftLoading] = useState(false)
  const [stockRequests, setStockRequests] = useState([])

  useEffect(() => { if (!isAdmin) navigate('/') }, [isAdmin, navigate])

  const QUIZ_PAGE_SIZE = 20

  const fetchQuizzes = useCallback(async () => {
    if (!db) return
    const snap = await getDocs(query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'), limit(QUIZ_PAGE_SIZE)))
    setQuizzes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    setQuizLastDoc(snap.docs[snap.docs.length - 1] ?? null)
    setQuizHasMore(snap.docs.length === QUIZ_PAGE_SIZE)
  }, [])

  const handleLoadMoreQuizzes = async () => {
    if (quizLoadingMore || !quizHasMore || !quizLastDoc) return
    setQuizLoadingMore(true)
    try {
      const snap = await getDocs(query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'), startAfter(quizLastDoc), limit(QUIZ_PAGE_SIZE)))
      setQuizzes((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...d.data() }))])
      setQuizLastDoc(snap.docs[snap.docs.length - 1] ?? null)
      setQuizHasMore(snap.docs.length === QUIZ_PAGE_SIZE)
    } finally {
      setQuizLoadingMore(false)
    }
  }

  const fetchGiftTab = useCallback(() => {
    if (!db) return () => {}
    setGiftLoading(true)
    const unsubGift = onSnapshot(
      query(collection(db, 'giftCards'), orderBy('createdAt', 'desc')),
      (snap) => { setGiftCards(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setGiftLoading(false) }
    )
    const unsubExchange = onSnapshot(
      query(collection(db, 'exchanges'), orderBy('requestedAt', 'desc')),
      (snap) => setExchangeRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    const unsubAlerts = onSnapshot(
      query(collection(db, 'adminAlerts'), orderBy('createdAt', 'desc')),
      (snap) => setStockRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => d.type === 'stock_request'))
    )
    return () => { unsubGift(); unsubExchange(); unsubAlerts() }
  }, [])

  const fetchDashboard = useCallback(async () => {
    if (!db) return
    setDashLoading(true)
    try {
      const [usersSnap, quizzesSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('points', '>=', Math.min(...GIFT_TIERS)))),
        getDocs(collection(db, 'quizzes')),
      ])
      setDashData({
        userPoints: usersSnap.docs.map((d) => d.data().points),
        quizzes: quizzesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      })
    } finally {
      setDashLoading(false)
    }
  }, [])

  const fetchChart = useCallback(async (from, to) => {
    if (!db) return
    setChartLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'dailyStats'), where('__name__', '>=', from), where('__name__', '<=', to))
      )
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = d.data() })

      const result = []
      const cur = new Date(from)
      const end = new Date(to)
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10)
        const d = map[key] ?? {}
        result.push({
          date: key.slice(5),
          수익: d.wrongPaid ?? 0,
          지출: d.bountyPaid ?? 0,
          정답: d.correct ?? 0,
        })
        cur.setDate(cur.getDate() + 1)
      }
      setChartData(result)
    } finally {
      setChartLoading(false)
    }
  }, [])

  const getChartRange = useCallback(() => {
    const todayKst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
    if (chartRange === 'custom') return { from: customFrom, to: customTo }
    const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365, 'all': 3650 }[chartRange]
    const from = new Date(new Date(todayKst).getTime() - (days - 1) * 86400000).toISOString().slice(0, 10)
    return { from, to: todayKst }
  }, [chartRange, customFrom, customTo])

  useEffect(() => { if (tab === 'quizzes' && !showForm) fetchQuizzes() }, [tab, showForm, fetchQuizzes])
  useEffect(() => { if (tab === 'dashboard') fetchDashboard() }, [tab, fetchDashboard])
  useEffect(() => { if (tab === 'gift') return fetchGiftTab() }, [tab, fetchGiftTab])
  useEffect(() => {
    if (tab !== 'dashboard') return
    if (chartRange === 'custom' && (!customFrom || !customTo)) return
    const { from, to } = getChartRange()
    fetchChart(from, to)
  }, [tab, chartRange, customFrom, customTo, fetchChart, getChartRange])

  useEffect(() => {
    const hints = hintsText.split('\n').map((h) => h.trim()).filter(Boolean).slice(0, 5)
    setPreviewHint(extractPreviewHint(hints, isHtml))
  }, [hintsText, isHtml])

  const handleTabChange = (t) => { setTab(t); setShowForm(false); setEditingQuiz(null) }

  const resetForm = () => {
    setIsHtml(false)
    setHintsText('')
    setAnswers([''])
    setPreviewHint('')
    setAdminNote('')
    setBounty(1000)
    setCustomBounty('')
    setPublishAt('')
    setShowHtmlPreview(false)
    setShowQuizPreview(false)
  }

  const openCreate = () => { setEditingQuiz(null); resetForm(); setShowForm(true) }

  const openEdit = (q) => {
    setEditingQuiz(q)
    setIsHtml(q.isHtml ?? false)
    setHintsText((q.hints ?? []).join('\n'))
    setAnswers(q.answers ?? (q.answer ? [q.answer] : ['']))
    setPreviewHint(q.previewHint ?? extractPreviewHint(q.hints ?? [], q.isHtml ?? false))
    setAdminNote(q.adminNote ?? '')
    const b = q.bounty
    if (BOUNTY_OPTIONS.includes(b)) { setBounty(b); setCustomBounty('') }
    else { setBounty(1000); setCustomBounty(String(b)) }
    setPublishAt(toDatetimeLocal(q.publishAt))
    setShowHtmlPreview(false)
    setShowQuizPreview(false)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingQuiz(null) }

  const addAnswer = () => setAnswers((prev) => [...prev, ''])
  const removeAnswer = (i) => setAnswers((prev) => prev.filter((_, idx) => idx !== i))
  const updateAnswer = (i, val) => setAnswers((prev) => prev.map((a, idx) => idx === i ? val : a))

  const handleDeleteQuiz = async (e, quiz) => {
    e.stopPropagation()
    if (!window.confirm(`문제 #${quiz.id.slice(0, 6)}를 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return
    await deleteDoc(doc(db, 'quizzes', quiz.id))
  }

  const handleAddGiftCard = async () => {
    if (!giftCode.trim() || !giftAmount) return
    await addDoc(collection(db, 'giftCards'), {
      code: giftCode.trim(),
      amount: Number(giftAmount),
      isUsed: false,
      createdAt: Timestamp.now(),
    })
    setGiftCode('')
    setGiftAmount('5000')
    setShowForm(false)
  }

  const handleToggleGiftCard = async (g) => {
    await updateDoc(doc(db, 'giftCards', g.id), { isUsed: !g.isUsed })
  }

  const handleCompleteExchange = async (r) => {
    await updateDoc(doc(db, 'exchanges', r.id), { status: 'done', processedAt: Timestamp.now() })
  }

  const getHintsArray = () => hintsText.split('\n').map((h) => h.trim()).filter(Boolean).slice(0, 5)
  const getAnswersArray = () => answers.map((a) => a.trim()).filter(Boolean)
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
          previewHint: previewHint.trim() || null,
          adminNote: adminNote.trim() || null,
          bounty: finalBounty,
          publishAt: publishTimestamp,
        })
        setQuizzes((prev) => prev.map((q) => q.id === editingQuiz.id
          ? { ...q, hints: validHints, isHtml, answers: validAnswers, previewHint: previewHint.trim() || null, adminNote: adminNote.trim() || null, bounty: finalBounty, publishAt: publishTimestamp }
          : q
        ))
        alert('수정되었습니다')
      } else {
        if (db) await addDoc(collection(db, 'quizzes'), {
          hints: validHints,
          isHtml,
          answers: validAnswers,
          previewHint: previewHint.trim() || null,
          adminNote: adminNote.trim() || null,
          bounty: finalBounty,
          initialBounty: finalBounty,
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

  const formatCreatedAt = (ts) => {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const formatPublishAt = (ts) => {
    if (!ts) return null
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 공개`
  }

  const hintsArray = getHintsArray()

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="back-btn" onClick={() => showForm ? (tab === 'gift' ? setShowForm(false) : closeForm()) : navigate(-1)}><ChevronLeft /></button>
        <h2>Admin</h2>
      </header>

      <div className="tab-bar">
        <button className={tab === 'quizzes' ? 'active' : ''} onClick={() => handleTabChange('quizzes')}>문제 관리</button>
        <button className={tab === 'gift' ? 'active' : ''} onClick={() => handleTabChange('gift')}>상품권 관리</button>
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => handleTabChange('dashboard')}>대시보드</button>
      </div>

      {tab === 'quizzes' && (
        showForm ? (
          <div className="create-tab">
            <div className="mode-toggle">
              <button className={`mode-btn ${!isHtml ? 'active' : ''}`} onClick={() => { setIsHtml(false); setHintsText(''); setShowHtmlPreview(false) }}>글자</button>
              <button className={`mode-btn ${isHtml ? 'active' : ''}`} onClick={() => { setIsHtml(true); setHintsText(''); setShowHtmlPreview(false) }}>HTML</button>
            </div>

            {/* 힌트 */}
            <section>
              <div className="label-row">
                <label>힌트 ({hintsArray.length}/5) · 엔터로 구분</label>
                {isHtml && (
                  <button className="preview-btn" onClick={() => setShowHtmlPreview((v) => !v)}>
                    {showHtmlPreview ? '편집' : 'HTML 미리보기'}
                  </button>
                )}
              </div>
              {isHtml && showHtmlPreview ? (
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

            {/* 카드 미리보기 힌트 */}
            <section>
              <label>카드 힌트 (자동 추출 · 수정 가능)</label>
              <input
                className="answer-field"
                value={previewHint}
                onChange={(e) => setPreviewHint(e.target.value)}
                placeholder="힌트를 입력하면 자동 추출됩니다"
              />
              <p className="publish-hint">퀴즈 목록 카드에 표시되는 첫 힌트</p>
            </section>

            {/* 정답 (복수 가능) */}
            <section>
              <div className="label-row">
                <label>정답</label>
                <button className="preview-btn" onClick={addAnswer}>+ 추가</button>
              </div>
              {answers.map((a, i) => (
                <div className="hint-row" key={i}>
                  <input
                    className="answer-field"
                    value={a}
                    onChange={(e) => updateAnswer(i, e.target.value)}
                    placeholder={i === 0 ? '정확한 정답 입력' : '추가 정답'}
                  />
                  {answers.length > 1 && (
                    <button className="remove-btn" onClick={() => removeAnswer(i)}>×</button>
                  )}
                </div>
              ))}
            </section>

            {/* 현상금 */}
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

            {/* 공개 예약 */}
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

            {/* 관리자 메모 */}
            <section>
              <label>관리자 메모 (나만 보임)</label>
              <input
                className="answer-field"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="출제 의도, 힌트 배경, 메모 등"
              />
            </section>

            {/* 퀴즈 미리보기 */}
            {hintsArray.length > 0 && (
              <section>
                <div className="label-row">
                  <label>퀴즈 미리보기</label>
                  <button className="preview-btn" onClick={() => setShowQuizPreview((v) => !v)}>
                    {showQuizPreview ? '접기' : '펼치기'}
                  </button>
                </div>
                {showQuizPreview && (
                  <div className="quiz-preview-box">
                    <div className="quiz-preview-bounty">{finalBounty.toLocaleString()} {CURRENCY}</div>
                    <HintsPreview hints={hintsArray} isHtml={isHtml} />
                    <div className="quiz-preview-input">정답을 입력하세요</div>
                  </div>
                )}
              </section>
            )}

            <button className="submit-btn" onClick={handleSave} disabled={submitting}>
              {submitting ? '저장 중...' : editingQuiz ? '수정 완료' : '문제 등록'}
            </button>
          </div>
        ) : (
          <div className="quizzes-tab">
            <div className="tab-section-header">
              <span>문제 목록 ({quizzes.length})</span>
            </div>
            {quizzes.map((q) => (
              <div key={q.id} className={`admin-quiz-card ${q.solvedBy ? 'solved' : ''}`} onClick={() => !q.solvedBy && openEdit(q)} style={{ cursor: q.solvedBy ? 'default' : 'pointer' }}>
                <div className="admin-quiz-card-top">
                  <span className="admin-quiz-id">#{q.id.slice(0, 6)}</span>
                  {q.createdAt && <span className="admin-quiz-date">{formatCreatedAt(q.createdAt)}</span>}
                  {q.solvedBy && <span className="solved-tag">종료</span>}
                  <button className="delete-quiz-btn" onClick={(e) => handleDeleteQuiz(e, q)}>✕</button>
                </div>
                <div className="admin-quiz-card-hints">
                  <HintsPreview hints={q.hints ?? []} isHtml={q.isHtml} />
                  <div className="admin-quiz-badges">
                    {q.isHtml && <span className="html-badge">HTML</span>}
                    {q.publishAt && !q.solvedBy && <span className="scheduled-badge">{formatPublishAt(q.publishAt)}</span>}
                  </div>
                </div>
                {q.adminNote && <p className="admin-quiz-note">{q.adminNote}</p>}
                <div className="admin-quiz-meta">
                  <span>정답: <b>{(q.answers ?? [q.answer]).join(' / ')}</b></span>
                  <span>현상금: <b>{q.bounty.toLocaleString()} {CURRENCY}</b></span>
                  <span>도전자: <b>{q.challengers}명</b></span>
                </div>
              </div>
            ))}
            {quizzes.length === 0 && <p className="empty-msg">등록된 문제가 없습니다</p>}
            {quizHasMore && (
              <div className="load-more-wrap">
                <button className="load-more-btn" onClick={handleLoadMoreQuizzes} disabled={quizLoadingMore}>
                  {quizLoadingMore ? <span className="spinner-sm" /> : '더 보기'}
                </button>
              </div>
            )}
          </div>
        )
      )}

      {tab === 'gift' && (
        showForm ? (
          <div className="gift-tab">
            <section>
              <label>상품권 코드 등록</label>
              <div className="gift-input-row">
                <input className="answer-field" value={giftCode} onChange={(e) => setGiftCode(e.target.value)} placeholder="상품권 코드" />
                <input className="answer-field gift-amount" type="number" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} onFocus={(e) => e.target.select()} placeholder="금액" />
                <button className="gift-add-btn" onClick={handleAddGiftCard}>추가</button>
              </div>
            </section>
          </div>
        ) : (
          <div className="gift-tab">
            <div className="tab-section-header">
              <span>미사용 {giftCards.filter(g => !g.isUsed).length}장</span>
            </div>
            {giftLoading ? <p className="empty-msg">불러오는 중...</p> : (
              <>
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
                          onClick={() => handleToggleGiftCard(g)}
                        >
                          {g.isUsed ? '취소' : '사용완료'}
                        </button>
                      </div>
                    ))}
                    {giftCards.length === 0 && <p className="empty-msg">등록된 상품권이 없습니다</p>}
                  </div>
                </section>
                {stockRequests.length > 0 && (
                  <section>
                    <label>재고 신청 ({stockRequests.length}건)</label>
                    <div className="gift-list">
                      {stockRequests.map((r) => (
                        <div key={r.id} className="gift-item">
                          <span className="gift-code">{r.nickname}</span>
                          <span className="gift-amount-tag">{r.amount.toLocaleString()}원권</span>
                          <span className="gift-date">
                            {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ko-KR') : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  <label>환전 내역</label>
                  <div className="gift-list">
                    {exchangeRequests.map((r) => (
                      <div key={r.id} className="gift-item used">
                        <span className="gift-code">{r.uid?.slice(0, 8)}</span>
                        <span className="gift-amount-tag">{r.amount.toLocaleString()}원</span>
                        <span className="gift-date">
                          {r.requestedAt?.toDate ? r.requestedAt.toDate().toLocaleDateString('ko-KR') : ''}
                        </span>
                        <span className="gift-status used">완료</span>
                      </div>
                    ))}
                    {exchangeRequests.length === 0 && <p className="empty-msg">내역 없음</p>}
                  </div>
                </section>
              </>
            )}
          </div>
        )
      )}

      {tab === 'dashboard' && (
        <div className="dashboard-tab">

          <section>
            <label>수익 그래프</label>
            <div className="chart-range-bar">
              {['7d','30d','90d','1y','all','custom'].map((r) => (
                <button key={r} className={`chart-range-btn ${chartRange === r ? 'active' : ''}`} onClick={() => setChartRange(r)}>
                  {r === '7d' ? '7일' : r === '30d' ? '1달' : r === '90d' ? '3달' : r === '1y' ? '1년' : r === 'all' ? '전체' : '기간'}
                </button>
              ))}
            </div>
            {chartRange === 'custom' && (
              <div className="chart-custom-range">
                <input type="date" className="answer-field" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <span>~</span>
                <input type="date" className="answer-field" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            )}
            {chartLoading ? (
              <p className="empty-msg">불러오는 중...</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-sub)' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-sub)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="수익" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="지출" stroke="#f87171" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="정답" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

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
                <section>
                  <label>준비 권장</label>
                  <div className="dash-recommend-list">
                    {recommendations.map((r) => (
                      <div key={r.amount} className={`dash-recommend-item ${r.toBuy > 0 ? 'action' : 'ok'}`}>
                        <span className="dash-recommend-amount">{r.amount.toLocaleString()}원 카드</span>
                        <span className="dash-recommend-msg">
                          {r.toBuy > 0 ? `${r.toBuy}장 구매 필요` : '충분'}
                        </span>
                        <span className="dash-recommend-detail">
                          재고 {r.stock}장 · 필요 {r.needed}장
                        </span>
                      </div>
                    ))}
                    {totalAction === 0 && <p className="dash-all-ok">현재 재고로 충분합니다</p>}
                  </div>
                </section>

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

                {(() => {
                  const total = dashData.quizzes.length
                  const solved = dashData.quizzes.filter(q => q.solvedBy).length
                  const active = total - solved
                  let profitCount = 0, lossCount = 0, totalPnl = 0
                  dashData.quizzes.forEach((q) => {
                    const initial = q.initialBounty ?? q.bounty
                    const pnl = (q.bounty - initial) - initial
                    totalPnl += pnl
                    if (pnl >= 0) profitCount++
                    else lossCount++
                  })
                  return (
                    <section>
                      <label>손익 요약</label>
                      <div className="dash-grid">
                        <div className="dash-card">
                          <span className="dash-count">{total}</span>
                          <span className="dash-label">전체 문제</span>
                        </div>
                        <div className="dash-card">
                          <span className="dash-count">{active}</span>
                          <span className="dash-label">진행중</span>
                        </div>
                        <div className="dash-card">
                          <span className="dash-count">{solved}</span>
                          <span className="dash-label">종료</span>
                        </div>
                        <div className={`dash-card ${profitCount > 0 ? 'profit' : ''}`}>
                          <span className="dash-count">{profitCount}</span>
                          <span className="dash-label">흑자 문제</span>
                        </div>
                        <div className={`dash-card ${lossCount > 0 ? 'warning' : ''}`}>
                          <span className="dash-count">{lossCount}</span>
                          <span className="dash-label">적자 문제</span>
                        </div>
                        <div className="dash-card" style={{ cursor: 'pointer' }} onClick={() => setPnlExpanded(v => !v)}>
                          <span className="dash-count" style={{ color: totalPnl < 0 ? '#f87171' : undefined, fontSize: pnlExpanded ? '1.1rem' : undefined }}>
                            {pnlExpanded ? (totalPnl >= 0 ? '+' : '') + totalPnl.toLocaleString() : fmtNum(totalPnl)}
                          </span>
                          <span className="dash-label">토탈 손익 ({CURRENCY})</span>
                        </div>
                      </div>
                    </section>
                  )
                })()}

              </>
            )
          })() : (
            <p className="empty-msg">새로고침을 눌러 불러오세요</p>
          )}
        </div>
      )}
      {tab === 'quizzes' && !showForm && (
        <button className="admin-fab" onClick={openCreate}>+</button>
      )}
      {tab === 'dashboard' && (
        <button className="admin-fab" onClick={fetchDashboard}><HiArrowPath /></button>
      )}
      {tab === 'gift' && !showForm && (
        <button className="admin-fab" onClick={() => setShowForm(true)}>+</button>
      )}
    </div>
  )
}