export const APP_NAME = 'Qwiz'
export const CURRENCY = 'QW'
export const PRIMARY_COLOR = '#cd9df1'
export const PRIMARY_DARK = '#b06fd8'

// 이벤트 보상
export const SIGNUP_REWARD = 500          // 신규 가입 즉시 지급
export const NEWBIE_FIRST_SOLVE = 500     // 신규 가입 후 7일 내 첫 정답 보너스 (친구에게)
export const REFERRAL_REWARD = 500        // 추천인 보상 - 친구가 7일 내 첫 정답 달성 시 지급
export const NEWBIE_PERIOD_DAYS = 7       // 신규 혜택 기간

// 추천인 영구 수익 쉐어
export const REFERRAL_SHARE_RATE = 0.01  // 추천받은 유저가 현상금 획득 시 1% 추천인에게 별도 지급 (획득자 현상금은 그대로)

// 레벨 시스템
// 조건: attempts(틀림 누적) OR solvedCount(맞춤 누적) 둘 중 하나 충족 시 레벨업
export const LEVEL_THRESHOLDS = [
  { level: 1, attempts: 0,    solved: 0,  bonus: 0.00 },
  { level: 2, attempts: 100,  solved: 1,  bonus: 0.01 },
  { level: 3, attempts: 200,  solved: 2,  bonus: 0.02 },
  { level: 4, attempts: 300,  solved: 3,  bonus: 0.03 },
  { level: 5, attempts: 500,  solved: 5,  bonus: 0.04 },
  { level: 6, attempts: 1000, solved: 10, bonus: 0.05 },
]

// 현재 레벨 계산 (attempts, solvedCount 기준)
export const calcLevel = (attempts = 0, solvedCount = 0) => {
  let level = 1
  for (const t of LEVEL_THRESHOLDS) {
    if (attempts >= t.attempts || solvedCount >= t.solved) level = t.level
  }
  return level
}

export const getLevelBonus = (attempts = 0, solvedCount = 0) =>
  LEVEL_THRESHOLDS.find(t => t.level === calcLevel(attempts, solvedCount))?.bonus ?? 0

// 개발용 접근 제어 - import.meta.env.DEV는 빌드 시 자동으로 false로 치환됨 (배포본에 코드 자체 없음)
export const DEV_ACCESS = {
  전체접근: import.meta.env.DEV,      // true면 로그인/admin/광고/쿨타임 전부 무시
  로그인: import.meta.env.DEV,        // 전체접근 false일 때 - 미로그인 허용
  admin: import.meta.env.DEV,         // 전체접근 false일 때 - admin 페이지 허용
  광고: import.meta.env.DEV,          // 광고 참가권 선택 시 광고 단계 스킵
  무료참가권쿨타임: import.meta.env.DEV, // 하루 1회 제한 무시
}
