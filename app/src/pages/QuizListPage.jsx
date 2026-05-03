import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, getDocs, limit, startAfter } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import { HiHome, HiUser, HiTicket, HiShoppingBag } from 'react-icons/hi2'
import './QuizListPage.css'
import { CURRENCY } from '../constants'
import PageLoading from '../components/PageLoading'

const PAGE_SIZE = 20
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
  const [sortBy, setSortBy] = useState('bounty') // 'bounty' | 'players'
  const [filter, setFilter] = useState('active')
  const navigate = useNavigate()
  const cachedUserData = useAuthStore((s) => s.userData)

  const [quizzes, setQuizzes] = useState([])
  const [lastDoc, setLastDoc] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const hasFreeTicket = (cachedUserData?.freeTicketLastUsed ?? null) !== today

  useEffect(() => {
    if (!db) return
    const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
    getDocs(q).then((snap) => {
      setQuizzes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHasMore(snap.docs.length === PAGE_SIZE)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !lastDoc) return
    setLoadingMore(true)
    try {
      const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE))
      const snap = await getDocs(q)
      setQuizzes((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...d.data() }))])
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHasMore(snap.docs.length === PAGE_SIZE)
    } finally {
      setLoadingMore(false)
    }
  }

  const sorted = useMemo(() => {
    const now = new Date()
    return [...quizzes]
      .filter((q) => {
        if (q.publishAt) {
          const d = q.publishAt.toDate ? q.publishAt.toDate() : new Date(q.publishAt)
          if (d > now) return false
        }
        if (filter === 'active') return !q.solvedBy
        if (filter === 'solved') return !!q.solvedBy
        return true
      })
      .sort((a, b) => sortBy === 'players'
        ? (b.activePlayers ?? 0) - (a.activePlayers ?? 0)
        : b.bounty - a.bounty
      )
  }, [quizzes, sortBy, filter])

  if (loading) return <PageLoading />

  return (
    <div className="quiz-list-page">
      <header className="quiz-list-header">
        <h2>Qwiz</h2>
        <div className="header-controls">
          <div className="filter-btns">
            <button className={`filter-btn ${sortBy === 'bounty' ? 'active' : ''}`} onClick={() => setSortBy('bounty')}>현상금순</button>
            <button className={`filter-btn ${sortBy === 'players' ? 'active' : ''}`} onClick={() => setSortBy('players')}>참여자순</button>
          </div>
          <div className="filter-btns">
            <button className={`filter-btn ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>진행중</button>
            <button className={`filter-btn ${filter === 'solved' ? 'active' : ''}`} onClick={() => setFilter('solved')}>종료</button>
            <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>전체</button>
          </div>
        </div>
      </header>

      {sorted.length === 0 ? (
        <p className="empty">등록된 퀴즈가 없습니다</p>
      ) : (
        <div className="quiz-list">
          {sorted.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} onClick={() => navigate(`/quiz/${quiz.id}`)} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="load-more-wrap">
          <button className="load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? <span className="spinner-sm" /> : '더 보기'}
          </button>
        </div>
      )}

      <div className="fab-area">
        <button className="fab-icon-btn" onClick={() => navigate('/')}><HiHome /></button>
        <button className="fab-icon-btn" onClick={() => navigate('/my')}><HiUser /></button>
        <button className="fab-icon-btn" onClick={() => navigate('/exchange')}><HiShoppingBag /></button>
        <button className={`fab-icon-btn ticket ${hasFreeTicket ? 'available' : 'used'}`} disabled><HiTicket /></button>
      </div>
    </div>
  )
}

function QuizCard({ quiz, onClick }) {
  const isSolved = quiz.solvedBy != null
  const challengerTag = getChallengerTag(quiz.challengers)
  const showNew = !isSolved && isNew(quiz.createdAt, quiz.challengers)

  return (
    <div className={`quiz-card ${isSolved ? 'solved' : ''}`} onClick={onClick}>
      <div className="quiz-card-left">
        <div className="quiz-card-top-row">
          <div className="quiz-card-bounty">{quiz.bounty.toLocaleString()} {CURRENCY}</div>
          <span className="quiz-card-id">#{quiz.id.slice(0, 6)}</span>
        </div>
        {quiz.previewHint && <p className="quiz-card-preview-hint">{quiz.previewHint}</p>}
        <div className="quiz-card-tags">
          {showNew && <span className="tag tag-new">NEW</span>}
          {challengerTag && <span className="tag tag-challenger">{challengerTag}</span>}
          {isSolved && <span className="tag tag-solved">종료</span>}
        </div>
      </div>
      <span className="quiz-card-arrow">›</span>
    </div>
  )
}
