import { useState, useEffect } from 'react'

const AD_TIPS = [
  '정답이 돈이다',
  '도전자가 많을수록 현상금은 커진다',
  '틀려도 괜찮아요, 현상금만 올라갈 뿐',
  '친구 초대하고 또 벌고',
]

export default function PageLoading() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * AD_TIPS.length))
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % AD_TIPS.length)
        setFade(true)
      }, 400)
    }, 10000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="page-loading">
      <div className="spinner" />
      <p className="page-loading-tip" style={{ opacity: fade ? 1 : 0, transition: 'opacity 0.4s ease' }}>
        {AD_TIPS[index]}
      </p>
    </div>
  )
}
