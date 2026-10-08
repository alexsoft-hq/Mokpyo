import { describe, it, expect } from 'vitest';
import { validatePassword, PASSWORD_POLICY_MESSAGE } from './password';

describe('validatePassword', () => {
  it('영문과 숫자를 포함한 8자 이상이면 null 을 반환한다', () => {
    expect(validatePassword('password1')).toBeNull();
    expect(validatePassword('Demo2026!')).toBeNull();
    expect(validatePassword('a1b2c3d4')).toBeNull();
  });

  it('8자 미만이면 정책 메시지를 반환한다', () => {
    expect(validatePassword('abc1234')).toBe(PASSWORD_POLICY_MESSAGE);
    expect(validatePassword('')).toBe(PASSWORD_POLICY_MESSAGE);
  });

  it('숫자가 없으면 정책 메시지를 반환한다', () => {
    expect(validatePassword('passwordonly')).toBe(PASSWORD_POLICY_MESSAGE);
  });

  it('영문이 없으면 정책 메시지를 반환한다', () => {
    expect(validatePassword('12345678')).toBe(PASSWORD_POLICY_MESSAGE);
    expect(validatePassword('한글비밀번호12345')).toBe(PASSWORD_POLICY_MESSAGE);
  });

  it('문자열이 아니면 정책 메시지를 반환한다', () => {
    expect(validatePassword(undefined)).toBe(PASSWORD_POLICY_MESSAGE);
    expect(validatePassword(null)).toBe(PASSWORD_POLICY_MESSAGE);
    expect(validatePassword(12345678)).toBe(PASSWORD_POLICY_MESSAGE);
  });
});
