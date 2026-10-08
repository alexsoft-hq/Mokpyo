import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendMail = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

describe('sendVerificationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log to console when SMTP is not configured', async () => {
    // Clear SMTP env vars
    delete process.env.SMTP_HOST;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Re-import to get fresh module without SMTP config
    vi.resetModules();
    vi.mock('nodemailer', () => ({
      default: {
        createTransport: vi.fn(() => ({
          sendMail: mockSendMail,
        })),
      },
    }));
    const { sendVerificationEmail } = await import('./email');

    await sendVerificationEmail('test@example.com', '123456');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('123456')
    );
    expect(mockSendMail).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should call sendMail when SMTP is configured', async () => {
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@test.com';
    process.env.SMTP_PASSWORD = 'password';
    process.env.SMTP_FROM = 'noreply@test.com';

    vi.resetModules();
    vi.mock('nodemailer', () => ({
      default: {
        createTransport: vi.fn(() => ({
          sendMail: mockSendMail,
        })),
      },
    }));
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });

    const { sendVerificationEmail } = await import('./email');

    await sendVerificationEmail('test@example.com', '654321');

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('654321'),
        html: expect.stringContaining('654321'),
      })
    );

    // Clean up env vars
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_FROM;
  });
});

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log the reset link when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.resetModules();
    const { sendPasswordResetEmail } = await import('./email');

    await sendPasswordResetEmail('test@example.com', 'http://localhost:8080/reset-password?token=abc123');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:8080/reset-password?token=abc123')
    );
    expect(mockSendMail).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should call sendMail with the reset link when SMTP is configured', async () => {
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_FROM = 'noreply@test.com';

    vi.resetModules();
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });

    const { sendPasswordResetEmail } = await import('./email');

    await sendPasswordResetEmail('test@example.com', 'https://app.example.com/reset-password?token=xyz');

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('비밀번호 재설정'),
        html: expect.stringContaining('https://app.example.com/reset-password?token=xyz'),
      })
    );

    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_FROM;
  });
});
