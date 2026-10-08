// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock api module
const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockVerifyEmail = vi.fn();
const mockResendVerification = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    login: (...args: any[]) => mockLogin(...args),
    register: (...args: any[]) => mockRegister(...args),
    verifyEmail: (...args: any[]) => mockVerifyEmail(...args),
    resendVerification: (...args: any[]) => mockResendVerification(...args),
  },
}));

// Mock fetch for auth config and /me endpoint
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper component to expose auth context
function AuthConsumer({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  onAuth(auth);
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="user-name">{auth.user?.name || 'none'}</span>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (localStorage.getItem as any).mockReturnValue(null);
  });

  it('should show loading initially and then finish', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ oauthEnabled: false, localAuthEnabled: true }),
    });

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authState.isLoading).toBe(false);
    });
  });

  it('should be unauthenticated when no token is stored', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ oauthEnabled: false, localAuthEnabled: true }),
    });

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authState.isLoading).toBe(false);
    });
    expect(authState.isAuthenticated).toBe(false);
    expect(authState.user).toBeNull();
  });

  it('should restore user from stored token', async () => {
    (localStorage.getItem as any).mockReturnValue('stored-token');

    // First call: config, second call: /me
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ oauthEnabled: false, localAuthEnabled: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: { userId: 'u1', email: 'a@b.com', name: 'User A', picture: null },
        }),
      });

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authState.isAuthenticated).toBe(true);
    });
    expect(authState.user?.name).toBe('User A');
  });

  it('should clear token when /me returns non-ok', async () => {
    (localStorage.getItem as any).mockReturnValue('bad-token');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ oauthEnabled: false, localAuthEnabled: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid token' }),
      });

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authState.isLoading).toBe(false);
    });
    expect(authState.isAuthenticated).toBe(false);
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
  });

  it('loginWithCredentials should set user and token on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ oauthEnabled: false, localAuthEnabled: true }),
    });

    mockLogin.mockResolvedValue({
      token: 'new-token',
      user: { userId: 'u2', email: 'b@c.com', name: 'User B' },
    });

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authState.isLoading).toBe(false);
    });

    await act(async () => {
      await authState.loginWithCredentials('b@c.com', 'pass');
    });

    expect(authState.isAuthenticated).toBe(true);
    expect(authState.user?.name).toBe('User B');
    expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'new-token');
  });

  it('register should return email without setting token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ oauthEnabled: false, localAuthEnabled: true }),
    });

    mockRegister.mockResolvedValue({
      message: '인증 코드를 이메일로 발송했습니다.',
      email: 'c@d.com',
    });

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authState.isLoading).toBe(false);
    });

    let result: any;
    await act(async () => {
      result = await authState.register('c@d.com', 'pass123', 'New User');
    });

    expect(result.email).toBe('c@d.com');
    expect(authState.isAuthenticated).toBe(false);
    expect(authState.user).toBeNull();
  });

  it('verifyEmail should set user and token on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ oauthEnabled: false, localAuthEnabled: true }),
    });

    mockVerifyEmail.mockResolvedValue({
      token: 'verify-token',
      user: { userId: 'u3', email: 'c@d.com', name: 'Verified User' },
    });

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authState.isLoading).toBe(false);
    });

    await act(async () => {
      await authState.verifyEmail('c@d.com', '123456');
    });

    expect(authState.isAuthenticated).toBe(true);
    expect(authState.user?.name).toBe('Verified User');
    expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'verify-token');
  });

  it('resendVerification should call api.resendVerification', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ oauthEnabled: false, localAuthEnabled: true }),
    });

    mockResendVerification.mockResolvedValue({ message: '재발송 완료' });

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authState.isLoading).toBe(false);
    });

    await act(async () => {
      await authState.resendVerification('c@d.com');
    });

    expect(mockResendVerification).toHaveBeenCalledWith('c@d.com');
  });

  it('logout should clear user and token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ oauthEnabled: false, localAuthEnabled: true }),
    });

    mockLogin.mockResolvedValue({
      token: 'tok',
      user: { userId: 'u1', email: 'a@b.com', name: 'A' },
    });

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(authState.isLoading).toBe(false));

    await act(async () => {
      await authState.loginWithCredentials('a@b.com', 'pass');
    });
    expect(authState.isAuthenticated).toBe(true);

    act(() => {
      authState.logout();
    });

    expect(authState.isAuthenticated).toBe(false);
    expect(authState.user).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
  });

  it('should set authConfig from server response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ oauthEnabled: true, localAuthEnabled: true }),
    });

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authState.authConfig).toEqual({ oauthEnabled: true, localAuthEnabled: true });
    });
  });

  it('should handle config fetch failure gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    let authState: any;
    render(
      <AuthProvider>
        <AuthConsumer onAuth={(a) => { authState = a; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authState.isLoading).toBe(false);
    });
    expect(authState.authConfig).toEqual({ oauthEnabled: false, localAuthEnabled: true });
    expect(authState.isAuthenticated).toBe(false);
  });
});
