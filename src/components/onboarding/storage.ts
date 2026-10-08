// 온보딩 체크리스트가 쓰는 localStorage 키. 체크리스트와 보드 뷰가 함께 참조한다.

export const onboardingDismissedKey = (orgId: string) => `mokpyo_onboarding_dismissed_${orgId}`;
export const onboardingBoardVisitedKey = (orgId: string) => `mokpyo_onboarding_board_visited_${orgId}`;

/** localStorage 가 막힌 환경(사생활 보호 모드 등)에서도 화면이 깨지지 않게 감싼다. */
export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* 저장 못 해도 기능에는 지장 없음 */
  }
}
