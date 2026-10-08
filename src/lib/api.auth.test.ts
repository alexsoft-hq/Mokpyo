import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally for Node environment
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: {} } });

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

// Must import after mocks
import { api } from './api';

describe('api.login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send POST request and return token + user on success', async () => {
    const mockResponse = {
      token: 'jwt-token',
      user: { userId: '1', email: 'test@example.com', name: 'Test' },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await api.login('test@example.com', 'password123');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      })
    );
    expect(result.token).toBe('jwt-token');
    expect(result.user.email).toBe('test@example.com');
  });

  it('should throw error with server message on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }),
    });

    await expect(api.login('bad@example.com', 'wrong')).rejects.toThrow(
      '이메일 또는 비밀번호가 올바르지 않습니다.'
    );
  });

  it('should throw default error message when server error has no message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await expect(api.login('a@b.com', 'x')).rejects.toThrow('로그인에 실패했습니다.');
  });

  it('should set needsVerification on error when server indicates it', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: '이메일 인증이 필요합니다.',
        needsVerification: true,
        email: 'test@example.com',
      }),
    });

    try {
      await api.login('test@example.com', 'password123');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.needsVerification).toBe(true);
      expect(err.email).toBe('test@example.com');
    }
  });
});

describe('api.register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send POST request and return message + email on success', async () => {
    const mockResponse = {
      message: '인증 코드를 이메일로 발송했습니다.',
      email: 'new@example.com',
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await api.register('new@example.com', 'password123', 'New');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/register'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'new@example.com', password: 'password123', name: 'New' }),
      })
    );
    expect(result.message).toContain('인증 코드');
    expect(result.email).toBe('new@example.com');
  });

  it('should throw error when email already exists', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '이미 사용 중인 이메일입니다.' }),
    });

    await expect(api.register('dup@example.com', 'password123', 'Dup')).rejects.toThrow(
      '이미 사용 중인 이메일입니다.'
    );
  });

  it('should throw error when password is too short', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '비밀번호는 6자 이상이어야 합니다.' }),
    });

    await expect(api.register('a@b.com', '123', 'A')).rejects.toThrow('6자');
  });
});

describe('api.verifyEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send POST request and return token + user on success', async () => {
    const mockResponse = {
      token: 'jwt-token',
      user: { userId: '1', email: 'test@example.com', name: 'Test' },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await api.verifyEmail('test@example.com', '123456');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/verify-email'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', code: '123456' }),
      })
    );
    expect(result.token).toBe('jwt-token');
    expect(result.user.email).toBe('test@example.com');
  });

  it('should throw error on invalid code', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '인증 코드가 일치하지 않습니다.' }),
    });

    await expect(api.verifyEmail('test@example.com', '000000')).rejects.toThrow('일치하지 않습니다');
  });
});

describe('api.resendVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send POST request and return message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: '인증 코드를 재발송했습니다.' }),
    });

    const result = await api.resendVerification('test@example.com');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/resend-verification'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      })
    );
    expect(result.message).toContain('재발송');
  });

  it('should throw error when user not found', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '사용자를 찾을 수 없습니다.' }),
    });

    await expect(api.resendVerification('nonexistent@example.com')).rejects.toThrow('사용자를 찾을 수 없습니다.');
  });
});

describe('api.updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send PUT request and return updated user', async () => {
    const mockResponse = {
      user: { userId: '1', email: 'test@example.com', name: 'New Name', picture: null },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const result = await api.updateProfile('New Name');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/profile'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'New Name' }),
      })
    );
    expect(result.user.name).toBe('New Name');
  });

  it('should throw error on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: '프로필 수정에 실패했습니다.' })),
    });

    await expect(api.updateProfile('')).rejects.toThrow('프로필 수정에 실패했습니다.');
  });
});

describe('api.changePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send PUT request and return success message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ message: '비밀번호가 변경되었습니다.' })),
    });

    const result = await api.changePassword('old123', 'new123');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/password'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ currentPassword: 'old123', newPassword: 'new123' }),
      })
    );
    expect(result.message).toContain('변경');
  });

  it('should throw error when current password is wrong', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: '현재 비밀번호가 올바르지 않습니다.' })),
    });

    await expect(api.changePassword('wrong', 'new123')).rejects.toThrow('현재 비밀번호');
  });
});

describe('api.selectDefaultAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send PUT request and return updated user', async () => {
    const mockResponse = {
      user: { userId: '1', email: 'test@example.com', name: 'Test', picture: 'default:3' },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const result = await api.selectDefaultAvatar('3');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/default-avatar'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ avatarId: '3' }),
      })
    );
    expect(result.user.picture).toBe('default:3');
  });

  it('should throw error on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: '아바타 설정에 실패했습니다.' })),
    });

    await expect(api.selectDefaultAvatar('99')).rejects.toThrow('아바타 설정에 실패했습니다.');
  });
});
