import express, { Request, Response } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { generateToken } from '../auth/jwt';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail, sendPasswordResetEmail } from '../auth/email';
import { validatePassword } from '../lib/password';
import { createStorageAdapter } from '../utils/storage';

const router = express.Router();

// Profile picture storage
const profileUploadsDir = path.join(process.cwd(), 'uploads', 'profiles');
if (!fs.existsSync(profileUploadsDir)) {
  fs.mkdirSync(profileUploadsDir, { recursive: true });
}
const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, profileUploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});
const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
    }
  },
});

// 발송 실패(SMTP 장애)를 500 으로 흘리지 않는다 — 계정은 이미 만들어졌고, 사용자는 '재발송'으로 복구할 수 있다.
async function sendVerificationEmailSafely(email: string, code: string): Promise<void> {
  try {
    await sendVerificationEmail(email, code);
  } catch (error) {
    console.error(`[Email Verification] 발송 실패 (${email}):`, error);
  }
}

function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

// 재설정 링크 유효 시간(60분). 짧게 두는 편이 메일함이 털렸을 때 피해가 작다.
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function buildResetUrl(rawToken: string): string {
  const baseUrl = process.env.APP_URL || 'http://localhost:8080';
  return `${baseUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
}

// 토큰 해시가 일치하고 아직 만료되지 않은 사용자를 찾는다. 없으면 null.
async function findUserByResetToken(rawToken: unknown) {
  if (typeof rawToken !== 'string' || !rawToken) return null;
  const tokenHash = hashResetToken(rawToken);
  const user = await prisma.user.findFirst({ where: { passwordResetTokenHash: tokenHash } });
  if (!user || !user.passwordResetExpiresAt) return null;
  if (new Date() > new Date(user.passwordResetExpiresAt)) return null;
  return user;
}

// Check if OAuth is enabled
router.get('/config', (req: Request, res: Response) => {
  const oauthEnabled = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CALLBACK_URL
  );
  const skipEmailVerification = process.env.SKIP_EMAIL_VERIFICATION === 'true';
  res.json({ oauthEnabled, localAuthEnabled: true, skipEmailVerification });
});

// Register with email/password
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: '이메일, 비밀번호, 이름을 모두 입력해주세요.' });
    }

    const policyError = validatePassword(password);
    if (policyError) {
      return res.status(400).json({ error: policyError });
    }

    const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === 'true';

    // Check for duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // If user exists but is not verified, allow re-registration with new code
      if (!existing.isEmailVerified && existing.passwordHash) {
        const passwordHash = await bcrypt.hash(password, 10);

        if (skipVerification) {
          const updatedUser = await prisma.user.update({
            where: { email },
            data: { name, passwordHash, isEmailVerified: true, emailVerificationCode: null, emailVerificationCodeExpiresAt: null },
          });
          const token = generateToken({ userId: updatedUser.id, email: updatedUser.email, name: updatedUser.name });
          return res.json({ message: '회원가입이 완료되었습니다.', email, token, user: { userId: updatedUser.id, email: updatedUser.email, name: updatedUser.name, picture: updatedUser.picture } });
        }

        const code = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        await prisma.user.update({
          where: { email },
          data: {
            name,
            passwordHash,
            emailVerificationCode: code,
            emailVerificationCodeExpiresAt: expiresAt,
          },
        });

        await sendVerificationEmailSafely(email, code);

        return res.json({
          message: '인증 코드를 이메일로 발송했습니다.',
          email,
        });
      }
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (skipVerification) {
      const newUser = await prisma.user.create({
        data: { email, name, passwordHash, isEmailVerified: true },
      });
      // Auto-create default workspace
      await prisma.organization.create({
        data: {
          name: `${name}의 워크스페이스`,
          slug: `ws-${newUser.id.slice(0, 8)}`,
          members: { create: { userId: newUser.id, role: 'OWNER' } },
        },
      });
      const token = generateToken({ userId: newUser.id, email: newUser.email, name: newUser.name });
      return res.json({ message: '회원가입이 완료되었습니다.', email, token, user: { userId: newUser.id, email: newUser.email, name: newUser.name, picture: newUser.picture } });
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        isEmailVerified: false,
        emailVerificationCode: code,
        emailVerificationCodeExpiresAt: expiresAt,
      },
    });

    await sendVerificationEmailSafely(email, code);

    res.json({
      message: '인증 코드를 이메일로 발송했습니다.',
      email,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: '회원가입에 실패했습니다.' });
  }
});

// Verify email with code
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: '이메일과 인증 코드를 입력해주세요.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: '이미 인증된 이메일입니다.' });
    }

    if (!user.emailVerificationCode || !user.emailVerificationCodeExpiresAt) {
      return res.status(400).json({ error: '인증 코드가 없습니다. 재발송을 요청해주세요.' });
    }

    if (new Date() > user.emailVerificationCodeExpiresAt) {
      return res.status(400).json({ error: '인증 코드가 만료되었습니다. 재발송을 요청해주세요.' });
    }

    if (user.emailVerificationCode !== code) {
      return res.status(400).json({ error: '인증 코드가 일치하지 않습니다.' });
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        isEmailVerified: true,
        emailVerificationCode: null,
        emailVerificationCodeExpiresAt: null,
      },
    });

    // Auto-create default workspace if user has none
    const existingMemberships = await prisma.organizationMember.count({
      where: { userId: updatedUser.id },
    });
    if (existingMemberships === 0) {
      await prisma.organization.create({
        data: {
          name: `${updatedUser.name}의 워크스페이스`,
          slug: `ws-${updatedUser.id.slice(0, 8)}`,
          members: { create: { userId: updatedUser.id, role: 'OWNER' } },
        },
      });
    }

    const token = generateToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
    });

    res.json({
      token,
      user: {
        userId: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        picture: updatedUser.picture,
      },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: '이메일 인증에 실패했습니다.' });
  }
});

// Resend verification code
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: '이메일을 입력해주세요.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: '이미 인증된 이메일입니다.' });
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: {
        emailVerificationCode: code,
        emailVerificationCodeExpiresAt: expiresAt,
      },
    });

    await sendVerificationEmailSafely(email, code);

    res.json({ message: '인증 코드를 재발송했습니다.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: '인증 코드 재발송에 실패했습니다.' });
  }
});

// Login with email/password
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === 'true';
    if (!skipVerification && !user.isEmailVerified) {
      return res.status(401).json({
        error: '이메일 인증이 필요합니다. 회원가입 시 발송된 인증 코드를 입력해주세요.',
        needsVerification: true,
        email: user.email,
      });
    }

    // SKIP_EMAIL_VERIFICATION 환경에서 미인증 사용자가 로그인하면 자동 인증 처리
    if (skipVerification && !user.isEmailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true, emailVerificationCode: null, emailVerificationCodeExpiresAt: null },
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    res.json({
      token,
      user: {
        userId: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인에 실패했습니다.' });
  }
});

// 비밀번호 재설정 요청.
// 계정이 있는지 없는지를 응답으로 알려주지 않는다(계정 존재 여부 탐색 방지) — 언제나 200 + 같은 문구.
router.post('/forgot-password', async (req: Request, res: Response) => {
  const genericMessage = '가입된 이메일이라면 재설정 링크를 보냈습니다.';
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: '이메일을 입력해주세요.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // 소셜 로그인 전용 계정(passwordHash 없음)은 재설정할 비밀번호가 없다.
    if (user && user.passwordHash) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: hashResetToken(rawToken),
          passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });
      // 메일 발송 실패(SMTP 장애 등)로 응답이 달라지면 계정 존재 여부가 새어 나간다.
      // 실패는 서버 로그에만 남기고 응답은 언제나 같은 문구로 돌려준다.
      try {
        await sendPasswordResetEmail(user.email, buildResetUrl(rawToken));
      } catch (mailError) {
        console.error('Password reset email send failed:', mailError);
      }
    }

    res.json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: '비밀번호 재설정 요청에 실패했습니다.' });
  }
});

// 재설정 링크 유효성 확인 — 화면 진입 시 만료된 링크를 미리 알려주기 위한 용도.
router.get('/reset-password/validate', async (req: Request, res: Response) => {
  try {
    const user = await findUserByResetToken(req.query.token);
    res.json({ valid: !!user });
  } catch (error) {
    console.error('Reset token validation error:', error);
    res.status(500).json({ error: '링크 확인에 실패했습니다.' });
  }
});

// 새 비밀번호 설정
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: '링크가 만료되었거나 올바르지 않습니다.' });
    }

    const policyError = validatePassword(password);
    if (policyError) {
      return res.status(400).json({ error: policyError });
    }

    const user = await findUserByResetToken(token);
    if (!user) {
      return res.status(400).json({ error: '링크가 만료되었거나 올바르지 않습니다.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        // 메일로 온 링크를 열었다는 것은 그 주소의 소유를 증명한 것이다.
        isEmailVerified: true,
        emailVerificationCode: null,
        emailVerificationCodeExpiresAt: null,
      },
    });

    res.json({ message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: '비밀번호 재설정에 실패했습니다.' });
  }
});

// Google OAuth login
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req: Request, res: Response) => {
    const user = req.user as any;

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Redirect to frontend with token
    // Frontend will extract token from URL and store in localStorage
    res.redirect(`/?token=${token}`);
  }
);

// Get current user info
router.get('/me', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true, picture: true, passwordHash: true },
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        userId: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        picture: dbUser.picture,
        // Google 전용 계정은 비밀번호가 없다 — 계정 삭제 확인 방식 결정에 쓴다.
        hasPassword: !!dbUser.passwordHash,
      },
    });
  } catch (error) {
    console.error('Failed to fetch user info:', error);
    res.json({ user: req.user });
  }
});

// Update profile (name)
router.put('/profile', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '이름을 입력해주세요.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name: name.trim() },
      select: { id: true, email: true, name: true, picture: true },
    });

    res.json({
      user: {
        userId: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        picture: updatedUser.picture,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: '프로필 수정에 실패했습니다.' });
  }
});

// Change password
router.put('/password', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' });
    }

    const policyError = validatePassword(newPassword);
    if (policyError) {
      return res.status(400).json({ error: policyError });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: '비밀번호를 변경할 수 없습니다.' });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { passwordHash: newHash },
    });

    res.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
  }
});

// Select default avatar
router.put('/default-avatar', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { avatarId } = req.body;
    if (!avatarId) {
      return res.status(400).json({ error: '아바타를 선택해주세요.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { picture: `default:${avatarId}` },
      select: { id: true, email: true, name: true, picture: true },
    });

    res.json({
      user: {
        userId: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        picture: updatedUser.picture,
      },
    });
  } catch (error) {
    console.error('Default avatar error:', error);
    res.status(500).json({ error: '아바타 설정에 실패했습니다.' });
  }
});

// Upload profile picture
router.post('/profile-picture', authenticateJWT, profileUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일을 선택해주세요.' });
    }

    const fileName = req.file.filename;
    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { picture: `upload:${fileName}` },
      select: { id: true, email: true, name: true, picture: true },
    });

    res.json({
      user: {
        userId: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        picture: updatedUser.picture,
      },
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: '프로필 사진 업로드에 실패했습니다.' });
  }
});

// Serve profile picture (no auth required)
router.get('/profile-picture/:fileName', (req: Request, res: Response) => {
  const { fileName } = req.params;
  // Prevent directory traversal
  const safeName = path.basename(fileName);
  const filePath = path.join(profileUploadsDir, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
});

// Logout (client-side only, just for consistency)
router.post('/logout', (req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;
