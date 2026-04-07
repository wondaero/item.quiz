import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './QuizListPage.css'
import { CURRENCY } from '../constants'

export default function QuizListPage() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // TODO: 개발용 목업 - Firebase 연결 후 아래 주석 해제하고 목업 제거
    const MOCK_QUIZZES = [
      { id: '1', hints: ['고라니', '모음', '비'], isHtml: false, bounty: 1043, challengers: 43, solvedBy: null },
      { id: '2', hints: ['사과', '빨강', '하루'], isHtml: false, bounty: 512, challengers: 12, solvedBy: null },
      { id: '3', hints: ['달', '토끼', '방아'], isHtml: false, bounty: 2000, challengers: 0, solvedBy: null },
      { id: '4', hints: ['<b style="color:#A855F7">눈</b>', '겨울', '하얀'], isHtml: true, bounty: 3077, challengers: 77, solvedBy: null },
      { id: '5', hints: ['종료된', '문제', '예시'], isHtml: false, bounty: 5000, challengers: 200, solvedBy: 'some-uid' },
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

  return (
    <div className="quiz-list-page">
      <header className="quiz-list-header">
        <h2>퀴즈 리스트</h2>
        <button className="my-info-btn" onClick={() => navigate('/my')}>내 정보</button>
      </header>

      {loading ? (
        <p className="loading">불러오는 중...</p>
      ) : quizzes.length === 0 ? (
        <p className="empty">등록된 퀴즈가 없습니다</p>
      ) : (
        <div className="quiz-grid">
          {quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} onClick={() => navigate(`/quiz/${quiz.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function QuizCard({ quiz, onClick }) {
  const isSolved = quiz.solvedBy != null

  return (
    <div className={`quiz-card ${isSolved ? 'solved' : ''}`} onClick={onClick}>
      <div className="quiz-card-bounty">{quiz.bounty.toLocaleString()} {CURRENCY}</div>
      <div className="quiz-card-hint-count">힌트 {quiz.hints.length}개</div>
      {isSolved && <span className="solved-badge">종료</span>}
    </div>
  )
}
