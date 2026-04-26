import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import './QuizDetailPage.css'
import { CURRENCY, DEV_ACCESS } from '../constants'

const getTodayString = () => new Date().toISOString().slice(0, 10)

const AD_TIPS = [
  '도전자가 많을수록 현상금은 커진다',
  '틀려도 괜찮아요, 현상금만 올라갈 뿐',
  '친구 초대하고 또 벌고',
]

function HintsDisplay({ hints, isHtml }) {
  return (
    <p className="hints">
      {isHtml
        ? <span dangerouslySetInnerHTML={{ __html: hints.join('<br/>') }} />
        : hints.join('\n')
      }
    </p>
  )
}

export default function QuizDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [quiz, setQuiz] = useState(null)
  const [userData, setUserData] = useState(null)
  const [answer, setAnswer] = useState('')
  const [phase, setPhase] = useState('loading-data')
  const [ticketType, setTicketType] = useState(null)
  const [result, setResult] = useState(null)
  const [leveledUp, setLeveledUp] = useState(null)
  const [lockedBounty, setLockedBounty] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    if (!db) return
    const fetchData = async () => {
      const [quizSnap, userSnap] = await Promise.all([
        getDoc(doc(db, 'quizzes', id)),
        getDoc(doc(db, 'users', user.uid)),
      ])
      if (!quizSnap.exists()) { navigate('/quiz'); return }
      const quizData = { id: quizSnap.id, ...quizSnap.data() }
      const userData = userSnap.exists() ? userSnap.data() : null
      setQuiz(quizData)
      setUserData(userData)

      if (quizData.solvedBy != null) {
        setPhase('archive')
        return
      }

      const hasFree = (DEV_ACCESS.전체접근 || DEV_ACCESS.무료참가권쿨타임)
        || userData?.freeTicketLastUsed !== getTodayString()

      if (DEV_ACCESS.전체접근 || DEV_ACCESS.광고 || hasFree) {
        // 무료권 있으면 바로 플레이
        const type = (DEV_ACCESS.전체접근 || DEV_ACCESS.광고 || hasFree) && hasFree ? 'free' : 'paid'
        if (hasFree) {
          await updateDoc(doc(db, 'users', user.uid), { freeTicketLastUsed: getTodayString() })
          await updateDoc(doc(db, 'quizzes', id), { activePlayers: increment(1) })
          setLockedBounty(quizData.bounty)
          setTicketType('free')
          setPhase('play')
        } else {
          setPhase('ad')
        }
      } else {
        setPhase('ad')
      }
    }
    fetchData()
  }, [id, user.uid])

  // 팁 순환
  useEffect(() => {
    if (phase !== 'ad') return
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % AD_TIPS.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [phase])

  useEffect(() => {
    if (phase !== 'play' || !db) return
    const unsub = onSnapshot(doc(db, 'quizzes', id), async (snap) => {
      const data = snap.data()
      if (data?.solvedBy && data.solvedBy !== user.uid) {
        const updates = [updateDoc(doc(db, 'quizzes', id), { activePlayers: increment(-1) })]
        if (ticketType === 'free') {
          updates.push(updateDoc(doc(db, 'users', user.uid), { freeTicketLastUsed: null }))
        }
        await Promise.all(updates)
        setPhase('kicked')
      }
    })
    return () => unsub()
  }, [phase, id, user.uid, ticketType])

  const handleAdWatched = useCallback(async () => {
    // TODO: 실제 AdMob 광고 시청 완료 후 호출
    if (db) await updateDoc(doc(db, 'quizzes', id), { activePlayers: increment(1) })
    setLockedBounty(quiz.bounty)
    setTicketType('paid')
    setPhase('play')
  }, [id, quiz])

  const handleQuit = async () => {
    if (db) await updateDoc(doc(db, 'quizzes', id), { activePlayers: increment(-1) })
    navigate('/quiz')
  }

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return
    setSubmitting(true)

    try {
      const submitAnswer = httpsCallable(functions, 'submitAnswer')
      const { data } = await submitAnswer({ quizId: id, answer, ticketType })

      if (data.result === 'already_solved') {
        setPhase('kicked')
        return
      }

      if (data.result === 'correct') {
        setLockedBounty(data.gain)
        if (data.leveledUpTo) setLeveledUp(data.leveledUpTo)
      }

      setResult(data.result)
      setPhase('result')
    } catch (e) {
      console.error('제출 오류', e)
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'loading-data') return <div className="page-loading"><div className="spinner" /></div>
  if (!quiz) return null

  return (
    <div className={`quiz-detail-page${phase === 'play' ? ' play-mode' : ''}`}>

      {phase === 'ad' && (
        <div className="ad-phase">
          <div className="ad-tip-box">
            <p className="ad-tip-label">잠깐, 알고 계셨나요?</p>
            <p className="ad-tip-text">{AD_TIPS[tipIndex]}</p>
          </div>
          <button className="btn-primary" onClick={handleAdWatched}>광고 보고 도전하기</button>
          <button className="btn-ghost" onClick={() => navigate(-1)}>돌아가기</button>
        </div>
      )}

      {phase === 'play' && (
        <>
          <div className="quiz-play-header">
            <button className="play-back-btn" onClick={() => setShowQuitConfirm(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="play-header-right">
              <span className="play-header-bounty">{lockedBounty.toLocaleString()} {CURRENCY}</span>
              <span className="ticket-type-badge">{ticketType === 'paid' ? '광고' : '무료'}</span>
            </div>
          </div>
          <div className="play-phase">
            <HintsDisplay hints={quiz.hints} isHtml={quiz.isHtml} />
            {showQuitConfirm ? (
              <div className="quit-confirm">
                <p>정말 포기할까요?</p>
                <p className="notice">참가권은 환불되지 않아요</p>
                <div className="quit-confirm-btns">
                  <button className="btn-primary" onClick={handleQuit}>포기</button>
                  <button className="btn-ghost" onClick={() => setShowQuitConfirm(false)}>계속 도전</button>
                </div>
              </div>
            ) : (
              <>
                <div className="answer-input-wrap">
                  <input
                    className="answer-input"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="정답을 입력하세요"
                    autoFocus
                  />
                  <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? '처리 중...' : '제출'}</button>
                </div>
                <p className="notice">* 정답은 정확히 입력해야 합니다 (띄어쓰기 포함)</p>
              </>
            )}
          </div>
        </>
      )}

      {phase === 'result' && (
        <div className="result-phase">
          {leveledUp && (
            <div className="levelup-banner">🎊 레벨 업! Lv.{leveledUp} 달성</div>
          )}
          {result === 'correct' ? (
            <>
              <div className="result-icon">🎉</div>
              <h2>정답!</h2>
              <p className="result-points">+{lockedBounty.toLocaleString()} {CURRENCY} 획득</p>
            </>
          ) : (
            <>
              <div className="result-icon">❌</div>
              <h2>오답</h2>
              {ticketType === 'paid'
                ? <p className="result-sub">현상금이 1 {CURRENCY} 올랐어요 · 1 {CURRENCY} 환불</p>
                : <p className="result-sub">현상금 변동 없음</p>
              }
              <button className="btn-primary" onClick={() => {
                setAnswer(''); setResult(null); setTicketType(null); setLockedBounty(0); setPhase('ad')
              }}>다시 도전하기</button>
            </>
          )}
          <button className="btn-ghost" onClick={() => navigate('/quiz')}>목록으로</button>
        </div>
      )}

      {phase === 'archive' && (
        <div className="play-phase">
          <div className="archive-badge">종료된 문제</div>
          <HintsDisplay hints={quiz.hints} isHtml={quiz.isHtml} />
          <div className="archive-answer">
            <span className="archive-answer-label">정답</span>
            <span className="archive-answer-value">{(quiz.answers ?? [quiz.answer]).join(' / ')}</span>
          </div>
          <button className="btn-ghost" onClick={() => navigate('/quiz')}>목록으로</button>
        </div>
      )}

      {phase === 'kicked' && (
        <div className="result-phase">
          <div className="result-icon">🚨</div>
          <h2>다른 사람이 먼저 맞췄어요</h2>
          <p className="result-sub">{ticketType === 'free' ? '무료 참가권이 복구되었습니다' : '참가권은 유지됩니다'}</p>
          <button className="btn-primary" onClick={() => navigate('/quiz')}>목록으로</button>
        </div>
      )}

    </div>
  )
}
