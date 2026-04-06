# Item Quiz - 프로젝트 컨텍스트

## 앱 개념
연상 단어 퀴즈 게임 앱. 관리자(개발자 본인)가 힌트 단어 3~5개를 올리면 유저들이 광고를 보고 입장해서 정답을 맞추는 구조.

### 핵심 메커닉
- 힌트는 단어 3~5개 (이미지 확장 고려)
- 참가권 2종류:
  - **광고 참가권**: 광고 시청으로 획득, 현상금 누적 기여(오답 +1P), 오답 시 1P 환불
  - **무료 참가권**: 하루 1회 무료 지급, 현상금 기여 없음, 오답 환불 없음
- 정답 맞추면 참가권 종류 무관하게 현상금 전액 획득
- 현상금은 광고 참가권 오답 1회당 +1P 누적
- **정답자 나오는 순간 그 문제 종료 → 나머지 도전자 강제 아웃 + 입장권 환불**
- 포인트 1:1 상품권 환전 (최소 20,000P)

### 퀴즈 난이도 예시
힌트: `고라니` `모음` `비` → 정답: `소나기`
- 고라니의 모음만 추출: ㅗ ㅏ ㅣ
- 비(rain) 관련 단어 중 ㅗ ㅏ ㅣ 모음 포함 = 소나기
- 유형이 매번 바뀜 (언어 구조, 연상, 조합 등)

### 수익 구조
- 광고 수익(입장료) - 현상금 지급 = 순이익
- 보상형 광고 단가 한국 기준 50~150원
- 초기 현상금: 500 / 1000 / 2000 / 3000 / 5000P 중 선택
- 참가자 적으면 적자 가능 → 문제 퀄리티가 핵심

### 정답 정책
- 관리자가 등록한 정답만 정답 (정확히 일치)
- 오류 발생 시 admin에서 정답 수정/추가 가능
- 유저에게 "정답은 정확히 입력" 고지

---

## 기술 스택
- **Frontend**: React + Vite
- **App 래핑**: Capacitor (Android/iOS)
- **DB + Auth**: Firebase (Firestore + Authentication)
- **상태관리**: Zustand
- **라우팅**: React Router DOM
- **광고**: AdMob (보상형, 추후 연동)
- **로그인**: 카카오 로그인만

### 스택 선정 이유
- Flutter 대신 React+Capacitor: 개발자가 웹 기반 작업 선호
- Supabase 대신 Firebase: 카카오 로그인 연동 편의성, NoSQL이 퀴즈 데이터 구조에 적합, 무료 한도 넉넉함
- 소켓 서버 없음: Firestore 실시간 리스너로 대체 가능, 서버 운영 비용 불필요

---

## 프로젝트 구조
```
app/                          # React 앱 (Vite)
├── src/
│   ├── pages/
│   │   ├── IntroPage.jsx     # 시작화면 (시작/설정/종료)
│   │   ├── LoginPage.jsx     # 카카오 로그인
│   │   ├── QuizListPage.jsx  # 퀴즈 목록 (메인)
│   │   ├── QuizDetailPage.jsx # 퀴즈 상세 + 광고 + 정답 제출
│   │   ├── MyPage.jsx        # 내 정보 + 포인트
│   │   ├── ExchangePage.jsx  # 환전소
│   │   └── AdminPage.jsx     # 관리자 전용 (문제 출제/목록)
│   ├── store/
│   │   └── useAuthStore.js   # Zustand - 로그인 상태, isAdmin
│   └── firebase/
│       └── config.js         # Firebase 초기화
├── .env                      # Firebase 설정값 (미입력 상태)
└── capacitor.config.json
```

---

## Firebase Firestore 컬렉션 구조

### `quizzes`
```
{
  hints: string[],        // 힌트 배열 (plain text 또는 HTML 문자열)
  isHtml: boolean,        // true면 hints를 HTML로 렌더링
  answers: string[],      // 정답 목록 (하나라도 일치하면 정답, 정확히 일치 비교)
  bounty: number,         // 현상금 (오답마다 +1)
  challengers: number,    // 총 도전자 수
  solvedBy: string|null,  // 정답자 uid (null이면 진행중)
  solvedAt: Timestamp,
  wrongAnswers: string[], // 오답 제출자 uid 목록
  createdAt: Timestamp
}
```

### `users`
```
{
  points: number,              // 보유 포인트
  attempts: number,            // 총 도전 횟수
  freeTicketLastUsed: string   // 무료 참가권 마지막 사용일 'YYYY-MM-DD' (없으면 사용 가능)
}
```

### `exchanges`
```
{
  uid: string,
  amount: number,
  status: 'pending' | 'done',
  requestedAt: Timestamp
}
```

---

## Admin 판별 방식
- `.env`의 `VITE_ADMIN_UID`와 로그인 유저의 uid 비교
- `useAuthStore`의 `isAdmin` 플래그로 관리
- AdminPage는 isAdmin=false면 자동으로 `/`로 리다이렉트

---

## 보류 중인 아이디어
- [ ] **포인트 환전** - 베스트는 카카오페이 포인트 지급 (사업자등록 + 카카오 비즈니스 심사 필요). 초기엔 컬처랜드 코드 수동 발급 + 최소 10,000P로 운영. 카카오페이 API 붙이면 최소 3,000~5,000P로 낮출 것
- [ ] **현상금 증가율 조절** - 참가자 수 구간별로 증가율 감소 (예: 100명 미만 1:1, 100~500명 2:1, 500명+ 3:1). 수익이 충분하면 불필요, 데이터 보고 판단
- [ ] **광고 제거 일일패스** - 1,000원 인앱결제 시 당일 광고 없이 무한 도전. 광고 단가 10원 기준 70회 이상 도전해야 본전이라 수익 유리. 구글 30% 수수료 감안해도 이득. Capacitor 인앱결제 플러그인 연동 필요
- [ ] **닉네임 신고 시스템** - 유저가 닉네임 신고 → Admin이 확인 → 강제 랜덤 닉네임 변경 + 변경 잠금. 초기엔 신고 자체가 거의 없을 것, 유저 생기면 그때 추가
- [ ] **랭킹 시스템** - 문제 맞춘 횟수 기반 순위 페이지. 추후 스킨 보상 연동 고려 (지금은 명예 랭킹만)
- [ ] **스킨 시스템** - 랭킹 보상으로 앱 스킨 지급. 리소스 및 적용 로직 공수 큼, 유저 반응 보고 추가

## 남은 작업 (미완료)
- [ ] Firebase 프로젝트 생성 + `.env` 설정값 입력
- [ ] 카카오 로그인 SDK 실제 연동 (LoginPage.jsx에 TODO 있음)
- [ ] AdMob 보상형 광고 실제 연동 (QuizDetailPage의 handleAdWatched에 TODO)
- [ ] 정답자 나왔을 때 다른 도전자 실시간 아웃 처리 (Firestore 리스너)
- [ ] 환전 신청 관리자 확인 UI (AdminPage에 환전 탭 추가 필요)
- [ ] 설정 페이지 (/settings 라우트 있으나 페이지 미생성)
- [ ] Capacitor Android/iOS 빌드 테스트
