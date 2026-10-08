// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';

// Mock useAuth
const mockLoginWithCredentials = vi.fn();
const mockAuthConfig = { oauthEnabled: false, localAuthEnabled: true };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    loginWithCredentials: mockLoginWithCredentials,
    authConfig: mockAuthConfig,
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

function renderLogin() {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
}

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render email and password inputs', () => {
    renderLogin();

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
  });

  it('should render login button', () => {
    renderLogin();

    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('should render register link', () => {
    renderLogin();

    expect(screen.getByText('회원가입')).toBeInTheDocument();
  });

  it('should render a link to the forgot-password page', () => {
    renderLogin();

    const link = screen.getByRole('link', { name: '비밀번호를 잊으셨나요?' });
    expect(link).toHaveAttribute('href', '/forgot-password');
  });

  it('should not show Google login button when oauthEnabled is false', () => {
    renderLogin();

    expect(screen.queryByText('Google로 로그인')).not.toBeInTheDocument();
  });

  it('should show Google login button when oauthEnabled is true', () => {
    mockAuthConfig.oauthEnabled = true;
    renderLogin();
    mockAuthConfig.oauthEnabled = false; // reset

    expect(screen.getByText('Google로 로그인')).toBeInTheDocument();
  });

  it('should call loginWithCredentials on form submit', async () => {
    mockLoginWithCredentials.mockResolvedValue(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(mockLoginWithCredentials).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('should navigate to "/" on successful login', async () => {
    mockLoginWithCredentials.mockResolvedValue(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('should display error message on login failure', async () => {
    mockLoginWithCredentials.mockRejectedValue(new Error('이메일 또는 비밀번호가 올바르지 않습니다.'));
    renderLogin();

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'wrong@example.com' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다.')).toBeInTheDocument();
    });
  });

  it('should show verification link when needsVerification error', async () => {
    const error: any = new Error('이메일 인증이 필요합니다.');
    error.needsVerification = true;
    error.email = 'unverified@example.com';
    mockLoginWithCredentials.mockRejectedValue(error);
    renderLogin();

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'unverified@example.com' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(screen.getByText('이메일 인증이 필요합니다.')).toBeInTheDocument();
    });
    expect(screen.getByText('인증 코드 입력하기')).toBeInTheDocument();
  });

  it('should show "로그인 중..." while submitting', async () => {
    let resolveLogin: () => void;
    mockLoginWithCredentials.mockImplementation(
      () => new Promise<void>((resolve) => { resolveLogin = resolve; })
    );
    renderLogin();

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(screen.getByText('로그인 중...')).toBeInTheDocument();
    });

    resolveLogin!();
  });
});
