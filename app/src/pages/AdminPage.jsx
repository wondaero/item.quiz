import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, getDocs, Timestamp, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import './AdminPage.css'

const BOUNTY_OPTIONS = [500, 1000, 2000, 3000, 5000]

export default function AdminPage() {
  const navigate = useNavigate()
  const isAdmin = useAuthStore((s) => s.isAdmin)

  const [tab, setTab] = useState('create') // 'create' | 'quizzes'
  const [isHtml, setIsHtml] = useState(false)
  const [hintsText, setHintsText] = useState('') // 엔터로 구분된 힌트 입력값
  const [showPreview, setShowPreview] = useState(false)
  const [answerText, setAnswerText] = useState('')
  const [bounty, setBounty] = useState(1000)
  const [customBounty, setCustomBounty] = useState('')
  const [quizzes, setQuizzes] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isAdmin) navigate('/')
  }, [isAdmin])

  useEffect(() => {
    if (tab === 'quizzes') fetchQuizzes()
  }, [tab])

  const handleModeToggle = (html) => {
    setIsHtml(html)
    setHintsText('')
    setShowPreview(false)
  }

  const fetchQuizzes = async () => {
    const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    setQuizzes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }

  const getHintsArray = () =>
    hintsText.split('\n').map((h) => h.trim()).filter(Boolean).slice(0, 5)

  const getAnswersArray = () => [answerText.trim()].filter(Boolean)

  const finalBounty = customBounty !== '' ? Number(customBounty) : bounty

  const handleCreate = async () => {
    const validHints = getHintsArray()
    const validAnswers = getAnswersArray()
    if (validHints.length < 1 || validAnswers.length < 1) {
      alert('힌트와 정답을 입력하세요')
      return
    }
    if (!finalBounty || finalBounty <= 0) {
      alert('현상금을 입력하세요')
      return
    }
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'quizzes'), {
        hints: validHints,
        isHtml,
        answers: validAnswers,
        bounty: finalBounty,
        challengers: 0,
        solvedBy: null,
        createdAt: Timestamp.now(),
      })
      setHintsText('')
      setAnswerText('')
      setBounty(1000)
      setCustomBounty('')
      setShowPreview(false)
      alert('문제가 등록되었습니다')
    } finally {
      setSubmitting(false)
    }
  }

  const hintsArray = getHintsArray()

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>Admin</h2>
      </header>

      <div className="tab-bar">
        <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>문제 출제</button>
        <button className={tab === 'quizzes' ? 'active' : ''} onClick={() => setTab('quizzes')}>문제 목록</button>
      </div>

      {tab === 'create' && (
        <div className="create-tab">

          {/* 모드 선택 */}
          <div className="mode-toggle">
            <button className={`mode-btn ${!isHtml ? 'active' : ''}`} onClick={() => handleModeToggle(false)}>글자</button>
            <button className={`mode-btn ${isHtml ? 'active' : ''}`} onClick={() => handleModeToggle(true)}>HTML</button>
          </div>

          {/* 힌트 입력 */}
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
                  : hintsArray.map((h, i) => (
                    <div key={i} className="html-preview" dangerouslySetInnerHTML={{ __html: h }} />
                  ))
                }
              </div>
            ) : (
              <textarea
                className={`hints-textarea ${isHtml ? 'monospace' : ''}`}
                value={hintsText}
                onChange={(e) => setHintsText(e.target.value)}
                placeholder={isHtml
                  ? '<b>고라니</b>\n<span style="color:red">모음</span>\n비'
                  : '고라니\n모음\n비'}
                rows={6}
              />
            )}
          </section>

          {/* 정답 */}
          <section>
            <label>정답</label>
            <input
              className="answer-field"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="정확한 정답 입력"
            />
          </section>

          {/* 현상금 */}
          <section>
            <label>초기 현상금</label>
            <div className="bounty-options">
              {BOUNTY_OPTIONS.map((b) => (
                <button
                  key={b}
                  className={`bounty-opt ${bounty === b && customBounty === '' ? 'selected' : ''}`}
                  onClick={() => { setBounty(b); setCustomBounty('') }}
                >
                  {b.toLocaleString()}P
                </button>
              ))}
            </div>
            <input
              className="answer-field"
              type="number"
              value={customBounty}
              onChange={(e) => setCustomBounty(e.target.value)}
              placeholder="직접 입력 (P)"
              min={1}
            />
            {customBounty !== '' && Number(customBounty) > 0 && (
              <p className="custom-bounty-preview">{Number(customBounty).toLocaleString()}P 설정됨</p>
            )}
          </section>

          <button className="submit-btn" onClick={handleCreate} disabled={submitting}>
            {submitting ? '등록 중...' : '문제 등록'}
          </button>
        </div>
      )}

      {tab === 'quizzes' && (
        <div className="quizzes-tab">
          {quizzes.map((q) => (
            <div key={q.id} className={`admin-quiz-card ${q.solvedBy ? 'solved' : ''}`}>
              <div className="admin-hints">
                {q.hints.map((h, i) => (
                  <span key={i}>
                    {q.isHtml ? <span dangerouslySetInnerHTML={{ __html: h }} /> : h}
                  </span>
                ))}
                {q.isHtml && <span className="html-badge">HTML</span>}
              </div>
              <div className="admin-quiz-meta">
                <span>정답: <b>{(q.answers ?? [q.answer]).join(' / ')}</b></span>
                <span>현상금: <b>{q.bounty}P</b></span>
                <span>도전자: <b>{q.challengers}명</b></span>
                {q.solvedBy && <span className="solved-tag">종료</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
