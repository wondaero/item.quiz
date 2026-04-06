import './LoginPage.css'

export default function LoginPage() {
  const handleKakaoLogin = () => {
    // TODO: 카카오 SDK 연동
    alert('카카오 로그인 준비중')
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>로그인</h2>
        <p>카카오 계정으로 시작하세요</p>
        <button className="kakao-btn" onClick={handleKakaoLogin}>
          <img src="/kakao-icon.svg" alt="kakao" />
          카카오로 시작하기
        </button>
      </div>
    </div>
  )
}
