// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';

// Mock useAuth
const mockRegister = vi.fn();
const mockVerifyEmail = vi.fn();
const mockResendVerification = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
    verifyEmail: mockVerifyEmail,
    resendVerification: mockResendVerification,
  }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderRegister(initialEntries: string[] = ['/register']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Register />
    </MemoryRouter>
  );
}

describe('Register Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all input fields', () => {
    renderRegister();

    expect(screen.getByLabelText('이름')).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호 확인')).toBeInTheDocument();
  });

  it('should render register button', () => {
    renderRegister();

    expect(screen.getByRole('button', { name: '회원가입' })).toBeInTheDocument();
  });

  it('should render login link', () => {
    renderRegister();

    expect(screen.getByText('로그인')).toBeInTheDocument();
  });

  it('should show error when passwords do not match', async () => {
    renderRegister();

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    await waitFor(() => {
      expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should show error when password is too short', async () => {
    renderRegister();

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'abc1234' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'abc1234' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    await waitFor(() => {
      expect(screen.getByText('비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.')).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should show error when password has no digit', async () => {
    renderRegister();

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'passwordonly' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'passwordonly' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    await waitFor(() => {
      expect(screen.getByText('비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.')).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should show the password policy hint and the terms notice', () => {
    renderRegister();

    expect(screen.getByText('8자 이상, 영문과 숫자 포함')).toBeInTheDocument();
    expect(screen.getByText(/동의하는 것으로 봅니다/)).toBeInTheDocument();
  });

  it('should call register and switch to verification step on success', async () => {
    mockRegister.mockResolvedValue({ email: 'new@example.com' });
    renderRegister();

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('new@example.com', 'password123', 'New User');
    });

    // Should now show verification form
    await waitFor(() => {
      expect(screen.getByLabelText('인증 코드')).toBeInTheDocument();
    });
    expect(screen.getByText('이메일 인증')).toBeInTheDocument();
  });

  it('should display server error on registration failure', async () => {
    mockRegister.mockRejectedValue(new Error('이미 사용 중인 이메일입니다.'));
    renderRegister();

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'Dup' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'dup@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    await waitFor(() => {
      expect(screen.getByText('이미 사용 중인 이메일입니다.')).toBeInTheDocument();
    });
  });

  it('should show "가입 중..." while submitting', async () => {
    let resolveRegister: () => void;
    mockRegister.mockImplementation(
      () => new Promise<void>((resolve) => { resolveRegister = resolve; })
    );
    renderRegister();

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    await waitFor(() => {
      expect(screen.getByText('가입 중...')).toBeInTheDocument();
    });

    resolveRegister!();
  });
});

describe('Register Page - Verification Step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show verification form when ?verify= param is present', () => {
    renderRegister(['/register?verify=test@example.com']);

    expect(screen.getByText('이메일 인증')).toBeInTheDocument();
    expect(screen.getByLabelText('인증 코드')).toBeInTheDocument();
  });

  it('should call verifyEmail and navigate on successful verification', async () => {
    mockVerifyEmail.mockResolvedValue(undefined);
    renderRegister(['/register?verify=test@example.com']);

    fireEvent.change(screen.getByLabelText('인증 코드'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '인증 완료' }));

    await waitFor(() => {
      expect(mockVerifyEmail).toHaveBeenCalledWith('test@example.com', '123456');
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('should display error on verification failure', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('인증 코드가 일치하지 않습니다.'));
    renderRegister(['/register?verify=test@example.com']);

    fireEvent.change(screen.getByLabelText('인증 코드'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: '인증 완료' }));

    await waitFor(() => {
      expect(screen.getByText('인증 코드가 일치하지 않습니다.')).toBeInTheDocument();
    });
  });

  it('should call resendVerification when resend button clicked', async () => {
    mockResendVerification.mockResolvedValue(undefined);
    renderRegister(['/register?verify=test@example.com']);

    fireEvent.click(screen.getByText('재발송'));

    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalledWith('test@example.com');
    });
    await waitFor(() => {
      expect(screen.getByText('인증 코드를 재발송했습니다.')).toBeInTheDocument();
    });
  });
});
