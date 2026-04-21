# Item Quiz (Qwiz) - 프로젝트 컨텍스트

## 앱 개념
연상 단어 퀴즈 게임 앱. 관리자(개발자 본인)가 힌트 단어 3~5개를 올리면 유저들이 광고를 보고 입장해서 정답을 맞추는 구조.

### 핵심 메커닉
- 힌트는 단어 3~5개 (이미지 확장 고려)
- 참가권 2종류:
  - **광고 참가권**: 광고 시청으로 획득, 현상금 누적 기여(오답 +1P), 오답 시 1P 환불
  - **무료 참가권**: 하루 1회 무료 지급, 현상금 기여 없음, 오답/포기 시 환불 없음
- 정답 맞추면 참가권 종류 무관하게 현상금 전액 획득
- 현상금은 광고 참가권 오답 1회당 +1P 누적
- **정답자 나오는 순간 그 문제 종료 → 나머지 도전자 강제 아웃**
- 포인트 1:1 신세계상품권 환전 (최소 20,000P)

### 퀴즈 난이도 예시
힌트: `고라니` `모음` `비` → 정답: `소나기`

### 정답 정책
- 관리자가 등록한 정답만 정답 (공백 제거 후 정확히 일치)
- Admin에서 정답 수정/추가 가능

---

## 현재 상태 (완료된 것들)

### 연결 완료
- Firebase 프로젝트: `qwiz-67f42` — `.env` 설정값 입력 완료
- 카카오 로그인 실제 연동 완료 (`throughTalk: !import.meta.env.DEV`)
- VITE_ADMIN_UID=4833965068 설정 완료

### 구현 완료
- 전체 페이지: IntroPage, LoginPage, QuizListPage, QuizDetailPage, MyPage, ExchangePage, AdminPage
- CSS 테마 시스템: `app/src/themes/dark.css` / `warm.css` — main.jsx import 한 줄로 전환
  - 현재: `import './themes/dark.css'` (dark 테마 사용 중, warm으로 바꾸려면 main.jsx 한 줄 변경)
- QuizDetailPage: runTransaction (동시 정답 방어), 이벤트 보상 로직, 포기 버튼 (왼쪽 상단 SVG 쉐브론)
  - 힌트: 배열을 `\n` 조인 + `white-space: pre-line` — 관리자가 엔터로 구분하면 줄바꿈, 옆에 쓰면 옆으로
  - 정답 입력창이 세로 레이아웃 (input → 제출 버튼 순서)
- QuizListPage: Firebase 실제 연결, 1열 리스트, 헤더에 소팅+필터(진행중/종료/전체)
  - 우하단 floating pill 메뉴: 🏠홈 / 👤내정보 / 🎟무료참가권(활성/비활성)
  - react-icons 설치 (hi2 패키지 사용)
- 이벤트 보상: 가입 +500QW, 첫 정답 7일 내 +500QW, 추천인 1% 영구 수익쉐어
- Firestore 보안 규칙: `firestore.rules` 파일 생성 (배포 대기)
- 전체 페이지 뒤로가기 버튼: ← 텍스트 → SVG 쉐브론 아이콘으로 교체
- **코드 정리 완료** (react 고수 스타일):
  - `LoginPage`: callback hell → async/await, Kakao SDK Promise 래핑
  - `QuizDetailPage`: `normalize` 컴포넌트 밖으로, `HintsDisplay` 컴포넌트 분리, `enterPlay` useCallback, `handleQuit` 네임드 함수
  - `AdminPage`: `ChevronLeft` SVG 컴포넌트 추출, `POINT_TIERS`/`GIFT_TIERS` 컴포넌트 밖으로, `fetchQuizzes`/`fetchDashboard` useCallback, 목업 데이터 제거 (giftCards/exchangeRequests 빈 배열)

### DEV_ACCESS (개발용 우회)
`constants.js`의 DEV_ACCESS — `import.meta.env.DEV` 기반, 빌드 시 자동 제거됨
- 전체접근/로그인/admin/광고/무료참가권쿨타임 우회

---

## 기술 스택
- **Frontend**: React + Vite
- **App 래핑**: Capacitor (Android/iOS)
- **DB**: Firebase Firestore
- **Auth**: 카카오 로그인만 (Firebase Auth 미연동 — request.auth 항상 null)
- **상태관리**: Zustand (localStorage 지속)
- **라우팅**: React Router DOM
- **광고**: AdMob (보상형, 추후 연동)
- **폰트**: Pretendard

---

## 프로젝트 구조
```
app/
├── src/
│   ├── pages/
│   │   ├── IntroPage.jsx / .css
│   │   ├── LoginPage.jsx / .css
│   │   ├── QuizListPage.jsx / .css     # Firebase 실 연결
│   │   ├── QuizDetailPage.jsx / .css   # runTransaction, 이벤트보상, 포기버튼
│   │   ├── MyPage.jsx / .css
│   │   ├── ExchangePage.jsx / .css
│   │   └── AdminPage.jsx / .css        # 3탭: 문제관리/상품권관리/대시보드
│   ├── themes/
│   │   ├── dark.css                    # 다크 네온 테마
│   │   └── warm.css                    # 웜 옐로우 테마 (현재 사용)
│   ├── store/
│   │   └── useAuthStore.js             # Zustand
│   ├── firebase/config.js
│   ├── constants.js                    # 보상 수치, DEV_ACCESS
│   └── main.jsx                        # 테마 import 위치
├── .env                                # 실 키값 입력 완료
firestore.rules                         # 보안 규칙 (배포 필요)
firebase.json
```

---

## Firebase Firestore 컬렉션 구조

### `quizzes`
```
{
  hints: string[],
  isHtml: boolean,
  answers: string[],
  bounty: number,
  challengers: number,
  activePlayers: number,    // 현재 풀고 있는 사람 수
  solvedBy: string|null,
  solvedAt: Timestamp,
  wrongAnswers: string[],
  publishAt: Timestamp|null, // 예약 공개 시간 (null이면 즉시)
  createdAt: Timestamp
}
```

### `users`
```
{
  points: number,
  attempts: number,
  freeTicketLastUsed: string|null,  // 'YYYY-MM-DD'
  referredBy: string|null,
  joinedAt: Timestamp,
  newbieBonusClaimed: boolean,
  nickname: string,
  profileImage: string|null
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

## Admin 판별
- `.env` VITE_ADMIN_UID (=4833965068) vs 로그인 uid 비교
- `useAuthStore`의 `isAdmin` 플래그

---

## 이벤트 보상 정책 (constants.js에서 수치 변경)
- 신규 가입: SIGNUP_REWARD = 500 QW
- 첫 정답 보너스: NEWBIE_FIRST_SOLVE = 500 QW (가입 후 NEWBIE_PERIOD_DAYS=7일 내)
- 추천인 보너스: REFERRAL_REWARD = 500 QW (친구가 7일 내 첫 정답 시)
- 추천인 영구 수익쉐어: REFERRAL_SHARE_RATE = 0.01 (1%)
- 모두 handleSubmit의 runTransaction 안에서 원자적으로 처리

---

## 보안 이슈 (Cloud Functions 붙이기 전까지 미해결)

### 1. Admin ID 취득
- `localStorage`에 `{uid: '4833965068'}` 직접 입력하면 Admin으로 인식됨
- `VITE_ADMIN_UID` 값이 빌드된 JS 번들에 노출되어 uid 값 확인 가능
- **피해 범위**: Admin 페이지 접근, 퀴즈 스팸 등록
- **해결책**: Cloud Functions로 카카오 토큰 검증 → Firebase Custom Token 발급 → Firestore 규칙에서 `request.auth.uid` 서버사이드 검증

### 2. 정답 유출
- QuizDetailPage에서 퀴즈 문서 전체를 fetch하므로 `answers` 필드가 클라이언트에 노출됨
- 개발자도구 Network 탭 또는 Firestore 직접 접근으로 정답 확인 가능
- **해결책**: Cloud Functions에서 정답 검증 (클라이언트에 answers 필드 내려주지 않음)

### 3. 포인트 직접 조작
- Firestore 규칙이 Firebase Auth 미연동으로 인해 서버사이드 uid 검증 불가
- 클라이언트에서 Firestore SDK로 직접 points 필드 조작 가능
- **해결책**: Cloud Functions에서 정답 처리 및 포인트 지급 (클라이언트는 읽기만)

> 세 가지 모두 **Cloud Functions + Firebase Custom Token** 도입으로 해결됨
> 유저 생기기 전에 반드시 처리할 것

---

## 남은 작업

### 급한 것 (너가 해야 할 것)
- [ ] Vercel 배포 + 카카오 도메인 등록 (외부 접근용, 모바일 테스트 위해)
- [ ] Firestore 보안 규칙 배포: `firebase deploy --only firestore:rules` (Firebase CLI 설치 필요)
- [ ] 카카오 개발자 콘솔 → 동의항목 → 닉네임 **필수동의** 설정 (현재 "익명"으로 뜸)

### 나랑 같이 해야 할 것
- [ ] AdminPage 상품권 관리 — Firebase 실 연결 (목업 제거됨, 빈 배열 상태)
- [ ] AdminPage 환전 신청 — Firebase 실 연결 (목업 제거됨, 빈 배열 상태)
- [ ] 환전 신청 재고 부족 시 관리자 알림 (adminAlerts + onSnapshot)
- [ ] Cloud Functions: 카카오 토큰 → Firebase Custom Token (보안 이슈 3개 한 번에 해결)
- [ ] IntroPage 배경 이미지 교체 (현재 dark 네온 이미지가 warm 테마와 안 어울림)
- [ ] /settings 페이지 구현 (라우트만 있음)
- [ ] AdMob 보상형 광고 연동 (handleAdWatched에 TODO, Android 빌드 후)
- [ ] FCM 푸시알림
- [ ] Capacitor Android 빌드 테스트

### 보류 아이디어
- 쿠폰함: 환전 신청 → Admin 코드 입력 → 앱 내 쿠폰함 표시
- 현상금 증가율 조절 (참가자 수 구간별)
- 광고 제거 일일패스 (1,000원 인앱결제)
- 랭킹/스킨 시스템
