// 비밀번호 정책 한 곳. register / PUT /password / reset-password 가 모두 이 함수를 쓴다.
// 정책이 바뀌면 여기만 고치면 되고, 사용자에게 보이는 문구도 한 벌로 유지된다.

export const PASSWORD_POLICY_MESSAGE = '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.';

/**
 * 정책 위반이면 사용자에게 보여줄 메시지를, 통과하면 null 을 돌려준다.
 * 정책: 8자 이상 + 영문 1자 이상 + 숫자 1자 이상.
 */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return PASSWORD_POLICY_MESSAGE;
  }
  if (!/[A-Za-z]/.test(password)) {
    return PASSWORD_POLICY_MESSAGE;
  }
  if (!/[0-9]/.test(password)) {
    return PASSWORD_POLICY_MESSAGE;
  }
  return null;
}
