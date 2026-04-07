import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './QuizListPage.css'
import { CURRENCY } from '../constants'

const CHALLENGER_TIERS = [1000, 500, 300, 200, 100, 50]

function getChallengerTag(challengers) {
  const tier = CHALLENGER_TIERS.find((t) => challengers >= t)
  return tier ? `${tier.toLocaleString()}+` : null
}

function isNew(createdAt, challengers) {
  if (challengers < 50) return true
  if (!createdAt) return false
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt)
  return Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000
}

export default function QuizListPage() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortAsc, setSortAsc] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // TODO: 개발용 목업 - Firebase 연결 후 아래 주석 해제하고 목업 제거
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000
    const MOCK_QUIZZES = [
      { id: '1', hints: ['고라니', '모음', '비'], isHtml: false, bounty: 1043, challengers: 43, solvedBy: null, createdAt: new Date(now - 2 * DAY) },
      { id: '2', hints: ['사과', '빨강', '하루'], isHtml: false, bounty: 512, challengers: 12, solvedBy: null, createdAt: new Date(now - 1 * DAY) },
      { id: '3', hints: ['달', '토끼', '방아'], isHtml: false, bounty: 2000, challengers: 0, solvedBy: null, createdAt: new Date(now - 10 * DAY) },
      { id: '4', hints: ['눈', '겨울', '하얀'], isHtml: false, bounty: 3077, challengers: 120, solvedBy: null, createdAt: new Date(now - 5 * DAY) },
      { id: '5', hints: ['종료된', '문제', '예시'], isHtml: false, bounty: 5000, challengers: 200, solvedBy: 'some-uid', createdAt: new Date(now - 20 * DAY) },
    ]
    setQuizzes(MOCK_QUIZZES)
    setLoading(false)

    // const fetchQuizzes = async () => {
    //   try {
    //     const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'))
    //     const snapshot = await getDocs(q)
    //     setQuizzes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    //   } catch (e) {
    //     console.error(e)
    //   } finally {
    //     setLoading(false)
    //   }
    // }
    // fetchQuizzes()
  }, [])

  const sorted = useMemo(() => {
    const now = new Date()
    return [...quizzes]
      .filter((q) => {
        if (!q.publishAt) return true
        const d = q.publishAt.toDate ? q.publishAt.toDate() : new Date(q.publishAt)
        return d <= now
      })
      .sort((a, b) => sortAsc ? a.bounty - b.bounty : b.bounty - a.bounty)
  }, [quizzes, sortAsc])

  return (
    <div className="quiz-list-page">
      <header className="quiz-list-header">
        <h2>퀴즈 리스트</h2>
        <button className="my-info-btn" onClick={() => navigate('/my')}>내 정보</button>
      </header>

      <div className="sort-bar">
        <button className="sort-btn" onClick={() => setSortAsc((v) => !v)}>
          현상금 {sortAsc ? '↑' : '↓'}
        </button>
      </div>

      {loading ? (
        <p className="loading">불러오는 중...</p>
      ) : sorted.length === 0 ? (
        <p className="empty">등록된 퀴즈가 없습니다</p>
      ) : (
        <div className="quiz-grid">
          {sorted.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} onClick={() => navigate(`/quiz/${quiz.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function QuizCard({ quiz, onClick }) {
  const isSolved = quiz.solvedBy != null
  const challengerTag = getChallengerTag(quiz.challengers)
  const showNew = !isSolved && isNew(quiz.createdAt, quiz.challengers)

  return (
    <div className={`quiz-card ${isSolved ? 'solved' : ''}`} onClick={onClick}>
      <div className="quiz-card-bounty">{quiz.bounty.toLocaleString()} {CURRENCY}</div>
      <div className="quiz-card-tags">
        {showNew && <span className="tag tag-new">NEW</span>}
        {challengerTag && <span className="tag tag-challenger">{challengerTag}</span>}
        {isSolved && <span className="tag tag-solved">종료</span>}
      </div>
    </div>
  )
}
