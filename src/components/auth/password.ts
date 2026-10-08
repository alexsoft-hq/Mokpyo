// 서버 server/lib/password.ts 와 같은 정책. 회원가입·비밀번호 재설정 두 화면이 함께 쓴다.
// 서버가 최종 판정을 하고, 여기서는 제출 전에 같은 문구로 미리 알려주기만 한다.

export const PASSWORD_HINT = '8자 이상, 영문과 숫자 포함';
export const PASSWORD_POLICY_MESSAGE = '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.';

/** 정책 위반이면 메시지를, 통과하면 null 을 돌려준다. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return PASSWORD_POLICY_MESSAGE;
  if (!/[A-Za-z]/.test(password)) return PASSWORD_POLICY_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_POLICY_MESSAGE;
  return null;
}
