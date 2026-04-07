export const APP_NAME = 'Qwiz'
export const CURRENCY = 'QW'
export const PRIMARY_COLOR = '#A855F7'
export const PRIMARY_DARK = '#7C3AED'

// 개발용 접근 제어 - import.meta.env.DEV는 빌드 시 자동으로 false로 치환됨 (배포본에 코드 자체 없음)
export const DEV_ACCESS = {
  전체접근: import.meta.env.DEV,      // true면 로그인/admin/광고/쿨타임 전부 무시
  로그인: import.meta.env.DEV,        // 전체접근 false일 때 - 미로그인 허용
  admin: import.meta.env.DEV,         // 전체접근 false일 때 - admin 페이지 허용
  광고: import.meta.env.DEV,          // 광고 참가권 선택 시 광고 단계 스킵
  무료참가권쿨타임: import.meta.env.DEV, // 하루 1회 제한 무시
}
