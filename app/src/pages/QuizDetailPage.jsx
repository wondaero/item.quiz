import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, increment, arrayUnion, Timestamp, onSnapshot, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'
import useAuthStore from '../store/useAuthStore'
import './QuizDetailPage.css'
import { CURRENCY, DEV_ACCESS, NEWBIE_FIRST_SOLVE, NEWBIE_PERIOD_DAYS, REFERRAL_REWARD, REFERRAL_SHARE_RATE } from '../constants'

function getTodayString() {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

export default function QuizDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [quiz, setQuiz] = useState(null)
  const [userData, setUserData] = useState(null)
  const [answer, setAnswer] = useState('')
  const [phase, setPhase] = useState('ticket') // 'ticket' | 'ad' | 'play' | 'result' | 'kicked'
  const [ticketType, setTicketType] = useState(null) // 'paid' | 'free'
  const [result, setResult] = useState(null) // 'correct' | 'wrong'
  const [lockedBounty, setLockedBounty] = useState(0) // 입장 시점 고정 현상금
  const [loading, setLoading] = useState(true)
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)

  useEffect(() => {
    if (!db) return
    const fetchData = async () => {
      const [quizSnap, userSnap] = await Promise.all([
        getDoc(doc(db, 'quizzes', id)),
        getDoc(doc(db, 'users', user.uid)),
      ])
      if (quizSnap.exists()) setQuiz({ id: quizSnap.id, ...quizSnap.data() })
      if (userSnap.exists()) setUserData(userSnap.data())
      setLoading(false)
    }
    fetchData()
  }, [id, user.uid])

  // play 단계 진입 시 실시간 리스너 - 다른 사람이 먼저 맞추면 강제 아웃
  useEffect(() => {
    if (phase !== 'play' || !db) return

    const unsub = onSnapshot(doc(db, 'quizzes', id), async (snap) => {
      const data = snap.data()
      if (data?.solvedBy && data.solvedBy !== user.uid) {
        if (db) {
          const updates = [updateDoc(doc(db, 'quizzes', id), { activePlayers: increment(-1) })]
          if (ticketType === 'free') updates.push(updateDoc(doc(db, 'users', user.uid), { freeTicketLastUsed: null }))
          await Promise.all(updates)
        }
        setPhase('kicked')
      }
    })

    return () => unsub()
  }, [phase, id, user.uid, ticketType])

  const isSolved = quiz?.solvedBy != null
  const hasFreeTicketToday = (DEV_ACCESS.전체접근 || DEV_ACCESS.무료참가권쿨타임) || userData?.freeTicketLastUsed !== getTodayString()

  // 종료된 문제는 바로 열람 모드로
  useEffect(() => {
    if (quiz && isSolved && phase === 'ticket') {
      setPhase('archive')
    }
  }, [quiz, isSolved, phase])

  const handleSelectPaid = async () => {
    setTicketType('paid')
    if (DEV_ACCESS.전체접근 || DEV_ACCESS.광고) {
      if (db) await updateDoc(doc(db, 'quizzes', id), { activePlayers: increment(1) })
      setLockedBounty(quiz.bounty)
      setPhase('play')
    } else {
      setPhase('ad')
    }
  }

  const handleSelectFree = async () => {
    if (db) await Promise.all([
      updateDoc(doc(db, 'users', user.uid), { freeTicketLastUsed: getTodayString() }),
      updateDoc(doc(db, 'quizzes', id), { activePlayers: increment(1) }),
    ])
    setLockedBounty(quiz.bounty)
    setTicketType('free')
    setPhase('play')
  }

  const handleAdWatched = async () => {
    // TODO: 실제 AdMob 광고 시청 완료 후 호출
    if (db) await updateDoc(doc(db, 'quizzes', id), { activePlayers: increment(1) })
    setLockedBounty(quiz.bounty)
    setPhase('play')
  }

  const handleSubmit = async () => {
    if (!answer.trim()) return

    const normalize = (s) => s.replace(/\s/g, '')
    const acceptedAnswers = quiz.answers ?? [quiz.answer]
    const isCorrect = acceptedAnswers.some((a) => normalize(a) === normalize(answer))

    if (db) {
      const quizRef = doc(db, 'quizzes', id)
      const userRef = doc(db, 'users', user.uid)

      if (isCorrect) {
        try {
          await runTransaction(db, async (transaction) => {
            const [quizDoc, userDoc] = await Promise.all([
              transaction.get(quizRef),
              transaction.get(userRef),
            ])

            // 이미 다른 사람이 정답 - 동시 제출 방어
            if (quizDoc.data()?.solvedBy) throw new Error('ALREADY_SOLVED')

            const uData = userDoc.data()
            const now = Timestamp.now()

            // 신규 첫 정답 보너스 계산
            let totalGain = lockedBounty
            let claimNewbie = false
            if (!uData.newbieBonusClaimed && uData.joinedAt) {
              const daysSinceJoin = (now.toMillis() - uData.joinedAt.toMillis()) / 86400000
              if (daysSinceJoin <= NEWBIE_PERIOD_DAYS) {
                totalGain += NEWBIE_FIRST_SOLVE
                claimNewbie = true
              }
            }

            transaction.update(quizRef, {
              solvedBy: user.uid,
              solvedAt: now,
              activePlayers: increment(-1),
            })
            transaction.update(userRef, {
              points: increment(totalGain),
              ...(claimNewbie && { newbieBonusClaimed: true }),
            })

            // 추천인 보상
            if (uData.referredBy) {
              const referrerRef = doc(db, 'users', uData.referredBy)
              // 1% 영구 수익쉐어
              let referrerGain = Math.floor(lockedBounty * REFERRAL_SHARE_RATE)
              // 첫 정답 달성 시 추천인 보너스 추가
              if (claimNewbie) referrerGain += REFERRAL_REWARD
              if (referrerGain > 0) {
                transaction.update(referrerRef, { points: increment(referrerGain) })
              }
            }
          })
        } catch (e) {
          if (e.message === 'ALREADY_SOLVED') {
            setPhase('kicked')
            return
          }
          console.error('정답 처리 오류', e)
          return
        }
      } else if (ticketType === 'paid') {
        await Promise.all([
          updateDoc(quizRef, { bounty: increment(1), challengers: increment(1), wrongAnswers: arrayUnion(user.uid), activePlayers: increment(-1) }),
          updateDoc(userRef, { points: increment(1), attempts: increment(1) }),
        ])
      } else {
        await Promise.all([
          updateDoc(quizRef, { challengers: increment(1), activePlayers: increment(-1) }),
          updateDoc(userRef, { attempts: increment(1) }),
        ])
      }
    }

    setResult(isCorrect ? 'correct' : 'wrong')
    setPhase('result')
  }

  if (loading) return <div className="quiz-detail-loading">불러오는 중...</div>
  if (!quiz) return <div className="quiz-detail-loading">퀴즈를 찾을 수 없습니다</div>

  return (
    <div className="quiz-detail-page">

      {phase === 'ticket' && (
        <div className="ticket-phase">
          <h2>참가권 선택</h2>
          <p className="ticket-desc">도전 방식을 선택하세요</p>

          <div className="ticket-card paid" onClick={handleSelectPaid}>
            <div className="ticket-title">광고 참가권</div>
            <ul className="ticket-benefits">
              <li>현상금 누적에 기여 (+1P)</li>
              <li>틀려도 1 {CURRENCY} 환불</li>
              <li>맞추면 현상금 전액 획득</li>
            </ul>
            <div className="ticket-action">광고 보고 도전</div>
          </div>

          <div className={`ticket-card free ${!hasFreeTicketToday ? 'used' : ''}`}
            onClick={hasFreeTicketToday ? handleSelectFree : undefined}>
            <div className="ticket-title">
              무료 참가권
              {!hasFreeTicketToday && <span className="used-badge">오늘 사용함</span>}
            </div>
            <ul className="ticket-benefits">
              <li>하루 1회 무료</li>
              <li>현상금 기여 없음</li>
              <li>틀려도 환불 없음</li>
              <li>맞추면 현상금 전액 획득</li>
            </ul>
            <div className="ticket-action">
              {hasFreeTicketToday ? '무료로 도전' : '내일 다시 사용 가능'}
            </div>
          </div>

          <div className="ticket-notice">
            ⚠️ 정답자가 나오면 도전이 종료되며 입장권은 자동 환불됩니다
          </div>
          <button className="btn-ghost" onClick={() => navigate(-1)}>돌아가기</button>
        </div>
      )}

      {phase === 'ad' && (
        <div className="ad-phase">
          <p>광고를 시청하면 퀴즈에 도전할 수 있어요</p>
          <button className="btn-primary" onClick={handleAdWatched}>광고 보고 도전하기</button>
          <button className="btn-ghost" onClick={() => navigate(-1)}>돌아가기</button>
        </div>
      )}

      {phase === 'play' && (
        <div className="play-phase">
          <div className="bounty-display">{lockedBounty.toLocaleString()} {CURRENCY}</div>
          <div className="ticket-type-badge">{ticketType === 'paid' ? '광고 참가권' : '무료 참가권'}</div>
          <div className="hints">
            {quiz.hints.map((hint, i) => (
              <div key={i} className="hint-item">
                {quiz.isHtml
                  ? <span dangerouslySetInnerHTML={{ __html: hint }} />
                  : hint
                }
              </div>
            ))}
          </div>
          <button className="play-back-btn" onClick={() => setShowQuitConfirm(true)}>←</button>
          {showQuitConfirm ? (
            <div className="quit-confirm">
              <p>정말 포기할까요?</p>
              <p className="notice">참가권은 환불되지 않아요</p>
              <div className="quit-confirm-btns">
                <button className="btn-primary" onClick={async () => {
                  if (db) await updateDoc(doc(db, 'quizzes', id), { activePlayers: increment(-1) })
                  navigate('/quiz')
                }}>포기</button>
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
                <button className="btn-primary" onClick={handleSubmit}>제출</button>
              </div>
              <p className="notice">* 정답은 정확히 입력해야 합니다 (띄어쓰기 포함)</p>
            </>
          )}
        </div>
      )}

      {phase === 'result' && (
        <div className="result-phase">
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
                setAnswer('')
                setResult(null)
                setTicketType(null)
                setLockedBounty(0)
                setPhase('ticket')
              }}>다시 도전하기</button>
            </>
          )}
          <button className="btn-ghost" onClick={() => navigate('/quiz')}>목록으로</button>
        </div>
      )}

      {phase === 'archive' && (
        <div className="play-phase">
          <div className="archive-badge">종료된 문제</div>
          <div className="hints">
            {quiz.hints.map((hint, i) => (
              <div key={i} className="hint-item">
                {quiz.isHtml
                  ? <span dangerouslySetInnerHTML={{ __html: hint }} />
                  : hint
                }
              </div>
            ))}
          </div>
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
          <p className="result-sub">
            {ticketType === 'free' ? '무료 참가권이 복구됐어요' : '참가권은 유지됩니다'}
          </p>
          <button className="btn-primary" onClick={() => navigate('/quiz')}>목록으로</button>
        </div>
      )}

    </div>
  )
}
