import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';


// vi.hoisted ensures these are available when vi.mock factories run (hoisted)
const { mockPrismaUser, mockPrismaOrgMember, mockPrismaOrg, mockBcrypt, mockSendVerificationEmail, mockSendPasswordResetEmail } = vi.hoisted(() => ({
  mockPrismaUser: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaOrgMember: {
    count: vi.fn().mockResolvedValue(0),
  },
  mockPrismaOrg: {
    create: vi.fn().mockResolvedValue({ id: 'org-1', name: 'Test Workspace', slug: 'ws-test' }),
  },
  mockBcrypt: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  mockSendVerificationEmail: vi.fn(),
  mockSendPasswordResetEmail: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    user = mockPrismaUser;
    organizationMember = mockPrismaOrgMember;
    organization = mockPrismaOrg;
  },
}));

vi.mock('bcryptjs', () => ({
  default: mockBcrypt,
}));

vi.mock('passport', () => ({
  default: {
    authenticate: vi.fn(() => (req: any, res: any, next: any) => next()),
  },
}));

vi.mock('../auth/email', () => ({
  sendVerificationEmail: mockSendVerificationEmail,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

// Import after mocks
import authRoutes from './auth';
import { generateToken } from '../auth/jwt';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendVerificationEmail.mockResolvedValue(undefined);
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
  });

  describe('GET /api/auth/config', () => {
    it('should return localAuthEnabled: true always', async () => {
      const app = createApp();
      const res = await request(app).get('/api/auth/config');

      expect(res.status).toBe(200);
      expect(res.body.localAuthEnabled).toBe(true);
    });

    it('should return oauthEnabled: false when Google env vars are not set', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.GOOGLE_CALLBACK_URL;

      const app = createApp();
      const res = await request(app).get('/api/auth/config');

      expect(res.status).toBe(200);
      expect(res.body.oauthEnabled).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return message with email', async () => {
      const app = createApp();
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        picture: null,
        isEmailVerified: false,
      };

      mockPrismaUser.findUnique.mockResolvedValue(null); // no existing user
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockPrismaUser.create.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
      expect(res.body.email).toBe('test@example.com');
      expect(res.body.token).toBeUndefined();
      expect(mockSendVerificationEmail).toHaveBeenCalledWith('test@example.com', expect.any(String));
    });

    it('should return 400 when email is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ password: 'password123', name: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('이메일');
    });

    it('should return 400 when password is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', name: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when name is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password is too short', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'abc1234', name: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('8자 이상');
    });

    it('should return 400 when password has no digit', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'passwordonly', name: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('영문과 숫자');
    });

    it('should return 409 when verified email already exists', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'existing-user',
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('이미 사용 중');
    });

    it('should allow re-registration for unverified user', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
        isEmailVerified: false,
        passwordHash: 'old-hash',
      });
      mockBcrypt.hash.mockResolvedValue('new-hash');
      mockPrismaUser.update.mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
      expect(res.body.email).toBe('test@example.com');
      expect(mockPrismaUser.update).toHaveBeenCalled();
      expect(mockSendVerificationEmail).toHaveBeenCalled();
    });

    it('should return 500 when database error occurs', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed');
      mockPrismaUser.create.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test' });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email and return token on valid code', async () => {
      const app = createApp();
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        picture: null,
        isEmailVerified: false,
        emailVerificationCode: '123456',
        emailVerificationCodeExpiresAt: futureDate,
      });
      mockPrismaUser.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        picture: null,
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'test@example.com', code: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.userId).toBe('user-1');
    });

    it('should return 400 when code does not match', async () => {
      const app = createApp();
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isEmailVerified: false,
        emailVerificationCode: '123456',
        emailVerificationCodeExpiresAt: futureDate,
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'test@example.com', code: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('일치하지 않습니다');
    });

    it('should return 400 when code is expired', async () => {
      const app = createApp();
      const pastDate = new Date(Date.now() - 10 * 60 * 1000);
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isEmailVerified: false,
        emailVerificationCode: '123456',
        emailVerificationCodeExpiresAt: pastDate,
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'test@example.com', code: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('만료');
    });

    it('should return 400 when email is already verified', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'test@example.com', code: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('이미 인증');
    });

    it('should return 404 when user not found', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'nonexistent@example.com', code: '123456' });

      expect(res.status).toBe(404);
    });

    it('should return 400 when email or code is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('인증 코드를 입력');
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should resend verification code', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isEmailVerified: false,
      });
      mockPrismaUser.update.mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('재발송');
      expect(mockSendVerificationEmail).toHaveBeenCalledWith('test@example.com', expect.any(String));
    });

    it('should return 400 when email is already verified', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('이미 인증');
    });

    it('should return 404 when user not found', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(404);
    });

    it('should return 400 when email is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials and return token', async () => {
      const app = createApp();
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        picture: null,
        passwordHash: 'hashed-password',
        isEmailVerified: true,
      };

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.userId).toBe('user-1');
    });

    it('should return 401 with needsVerification when email not verified', async () => {
      const app = createApp();
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        passwordHash: 'hashed-password',
        isEmailVerified: false,
      };

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('이메일 인증');
      expect(res.body.needsVerification).toBe(true);
      expect(res.body.email).toBe('test@example.com');
    });

    it('should return 400 when email is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('이메일');
    });

    it('should return 400 when password is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });

    it('should return 401 when user not found', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('이메일 또는 비밀번호');
    });

    it('should return 401 when user has no passwordHash (OAuth-only user)', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: null,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });

    it('should return 401 when password is wrong', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed',
        isEmailVerified: true,
      });
      mockBcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('이메일 또는 비밀번호');
    });

    it('should return 500 when database error occurs', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send a reset link and return the generic message for a local account', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed',
      });
      mockPrismaUser.update.mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('가입된 이메일이라면 재설정 링크를 보냈습니다.');
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('/reset-password?token=')
      );
      // 원문 토큰이 아니라 해시가 저장되어야 한다.
      const updateArg = mockPrismaUser.update.mock.calls[0][0];
      const sentUrl: string = mockSendPasswordResetEmail.mock.calls[0][1];
      const rawToken = sentUrl.split('token=')[1];
      expect(updateArg.data.passwordResetTokenHash).toBeTruthy();
      expect(updateArg.data.passwordResetTokenHash).not.toBe(rawToken);
      expect(updateArg.data.passwordResetExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return the same message without sending when the account does not exist', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('가입된 이메일이라면 재설정 링크를 보냈습니다.');
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
      expect(mockPrismaUser.update).not.toHaveBeenCalled();
    });

    it('should not send for an OAuth-only account (no passwordHash)', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'oauth@example.com',
        passwordHash: null,
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'oauth@example.com' });

      expect(res.status).toBe(200);
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should still return the generic message when the email fails to send', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed',
      });
      mockPrismaUser.update.mockResolvedValue({});
      mockSendPasswordResetEmail.mockRejectedValue(new Error('SMTP down'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('가입된 이메일이라면 재설정 링크를 보냈습니다.');
      consoleSpy.mockRestore();
    });

    it('should return 400 when email is missing', async () => {
      const app = createApp();
      const res = await request(app).post('/api/auth/forgot-password').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('이메일');
    });

    it('should return 500 when database error occurs', async () => {
      const app = createApp();
      mockPrismaUser.findUnique.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/auth/reset-password/validate', () => {
    it('should return valid: true for a matching, unexpired token', async () => {
      const app = createApp();
      mockPrismaUser.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordResetTokenHash: 'hash',
        passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const res = await request(app).get('/api/auth/reset-password/validate?token=abc');

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    it('should return valid: false for an expired token', async () => {
      const app = createApp();
      mockPrismaUser.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordResetTokenHash: 'hash',
        passwordResetExpiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app).get('/api/auth/reset-password/validate?token=abc');

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('should return valid: false for an unknown token', async () => {
      const app = createApp();
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const res = await request(app).get('/api/auth/reset-password/validate?token=nope');

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('should return valid: false when token param is missing', async () => {
      const app = createApp();
      const res = await request(app).get('/api/auth/reset-password/validate');

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(mockPrismaUser.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should update the password, clear the token and mark the email verified', async () => {
      const app = createApp();
      mockPrismaUser.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordResetTokenHash: 'hash',
        passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      mockBcrypt.hash.mockResolvedValue('new-hash');
      mockPrismaUser.update.mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'abc', password: 'newpass123' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('비밀번호가 변경');
      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            passwordHash: 'new-hash',
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
            isEmailVerified: true,
          }),
        })
      );
    });

    it('should return 400 for an expired token', async () => {
      const app = createApp();
      mockPrismaUser.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordResetTokenHash: 'hash',
        passwordResetExpiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'abc', password: 'newpass123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('만료되었거나');
      expect(mockPrismaUser.update).not.toHaveBeenCalled();
    });

    it('should return 400 for an unknown token', async () => {
      const app = createApp();
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'nope', password: 'newpass123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('만료되었거나');
    });

    it('should return 400 when the new password violates the policy', async () => {
      const app = createApp();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'abc', password: 'short1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('8자 이상');
      expect(mockPrismaUser.findFirst).not.toHaveBeenCalled();
    });

    it('should return 400 when token is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ password: 'newpass123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('만료되었거나');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user info for a valid token', async () => {
      const app = createApp();
      const token = generateToken({ userId: 'user-1', email: 'a@b.com', name: 'A' });

      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        name: 'A',
        picture: 'https://example.com/pic.jpg',
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.userId).toBe('user-1');
      expect(res.body.user.email).toBe('a@b.com');
      expect(res.body.user.picture).toBe('https://example.com/pic.jpg');
    });

    it('should return 401 without a token', async () => {
      const app = createApp();
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return 404 when user not found in DB', async () => {
      const app = createApp();
      const token = generateToken({ userId: 'deleted-user', email: 'a@b.com', name: 'A' });
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update name successfully', async () => {
      const app = createApp();
      const token = generateToken({ userId: 'user-1', email: 'a@b.com', name: 'Old' });

      mockPrismaUser.update.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        name: 'New Name',
        picture: null,
      });

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('New Name');
      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { name: 'New Name' },
        })
      );
    });

    it('should return 401 without auth', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ name: 'New' });

      expect(res.status).toBe(401);
    });

    it('should return 400 when name is empty', async () => {
      const app = createApp();
      const token = generateToken({ userId: 'user-1', email: 'a@b.com', name: 'A' });

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/auth/password', () => {
    it('should change password successfully', async () => {
      const app = createApp();
      const token = generateToken({ userId: 'user-1', email: 'a@b.com', name: 'A' });

      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      });
      mockBcrypt.compare.mockResolvedValue(true);
      mockBcrypt.hash.mockResolvedValue('new-hash');
      mockPrismaUser.update.mockResolvedValue({});

      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'old12345', newPassword: 'new12345' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('변경');
    });

    it('should return 401 when current password is wrong', async () => {
      const app = createApp();
      const token = generateToken({ userId: 'user-1', email: 'a@b.com', name: 'A' });

      mockPrismaUser.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      });
      mockBcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrong', newPassword: 'new12345' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('현재 비밀번호');
    });

    it('should return 400 when new password is too short', async () => {
      const app = createApp();
      const token = generateToken({ userId: 'user-1', email: 'a@b.com', name: 'A' });

      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'old12345', newPassword: 'abc1234' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('8자 이상');
    });
  });

  describe('PUT /api/auth/default-avatar', () => {
    it('should set default avatar successfully', async () => {
      const app = createApp();
      const token = generateToken({ userId: 'user-1', email: 'a@b.com', name: 'A' });

      mockPrismaUser.update.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        name: 'A',
        picture: 'default:3',
      });

      const res = await request(app)
        .put('/api/auth/default-avatar')
        .set('Authorization', `Bearer ${token}`)
        .send({ avatarId: '3' });

      expect(res.status).toBe(200);
      expect(res.body.user.picture).toBe('default:3');
    });

    it('should return 400 when avatarId is missing', async () => {
      const app = createApp();
      const token = generateToken({ userId: 'user-1', email: 'a@b.com', name: 'A' });

      const res = await request(app)
        .put('/api/auth/default-avatar')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return success', async () => {
      const app = createApp();
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
