// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setLanguage, t } from '@/i18n';
import Register from './Register';
import ResetPassword from './ResetPassword';
import Login from './Login';

const mocks = vi.hoisted(() => ({
  register: vi.fn(), reset: vi.fn(), validate: vi.fn(), login: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ api: {
  validateResetToken: mocks.validate,
  resetPassword: mocks.reset,
} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({
  register: mocks.register,
  loginWithCredentials: mocks.login,
  authConfig: { oauthEnabled: false, localAuthEnabled: true },
}) }));
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.validate.mockResolvedValue({ valid: true });
  await setLanguage('ko');
});
afterEach(async () => {
  cleanup();
  await setLanguage('ko');
});

function changeLanguage(language: 'ko' | 'en') {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: language } });
}

describe('auth feedback language changes', () => {
  it.each([
    ['register', 'mismatch'], ['reset', 'mismatch'],
    ['register', 'policy'], ['reset', 'policy'],
  ])('updates %s %s feedback without remounting or clearing inputs', async (page, validation) => {
    const reset = page === 'reset';
    const result = render(<MemoryRouter initialEntries={[reset ? '/reset-password?token=abc' : '/register']}>
      {reset ? <ResetPassword /> : <Register />}
    </MemoryRouter>);
    const password = await screen.findByLabelText(reset ? '새 비밀번호' : '비밀번호');
    const confirmation = screen.getByLabelText(reset ? '새 비밀번호 확인' : '비밀번호 확인');
    if (!reset) {
      fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'Alice' } });
      fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'alice@example.com' } });
    }
    const first = validation === 'mismatch' ? 'password123' : 'abcdefgh';
    const second = validation === 'mismatch' ? 'password456' : first;
    fireEvent.change(password, { target: { value: first } });
    fireEvent.change(confirmation, { target: { value: second } });
    fireEvent.submit(result.container.querySelector('form')!);
    const key = validation === 'mismatch' ? '비밀번호가 일치하지 않습니다.' : '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.';
    expect(screen.getByRole('alert')).toHaveTextContent(key);
    changeLanguage('en');
    expect(screen.getByRole('alert')).toHaveTextContent(t(key));
    expect(screen.getByRole('alert').textContent).not.toMatch(/[가-힣]/);
    expect(password).toBeInTheDocument();
    expect(password).toHaveValue(first);
    expect(confirmation).toHaveValue(second);
    changeLanguage('ko');
    expect(screen.getByRole('alert')).toHaveTextContent(key);
    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    if (reset) expect(mocks.validate).toHaveBeenCalledTimes(1);
  });

  it('updates the expired-session notice in place', () => {
    render(<MemoryRouter initialEntries={['/login?expired=1']}><Login /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    changeLanguage('en');
    expect(screen.getByRole('alert')).toHaveTextContent(t('로그인 세션이 만료되었습니다. 다시 로그인해주세요.'));
  });

  it('preserves the message supplied by the API error layer', async () => {
    mocks.login.mockRejectedValue(new Error('External authentication detail: α'));
    const result = render(<MemoryRouter><Login /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password123' } });
    fireEvent.submit(result.container.querySelector('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('External authentication detail: α');
    changeLanguage('en');
    expect(screen.getByRole('alert')).toHaveTextContent('External authentication detail: α');
  });
});
