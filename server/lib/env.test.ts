import { describe, it, expect } from 'vitest';
import { validateEnv, corsOptions } from './env';

const good = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'a'.repeat(32), SESSION_SECRET: 'b'.repeat(32), APP_URL: 'https://app' };

describe('validateEnv', () => {
  it('정상 설정이면 통과한다', () => {
    expect(() => validateEnv({ ...good, NODE_ENV: 'development' } as any)).not.toThrow();
  });
  it('운영에서 기본 시크릿이면 기동을 거부한다', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => validateEnv({ ...good, JWT_SECRET: 'default-secret-change-this' } as any)).toThrow(/JWT_SECRET/);
      expect(() => validateEnv({ ...good, APP_URL: '' } as any)).toThrow(/APP_URL/);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
  it('개발에서는 경고만 하고 통과한다', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(() => validateEnv({ ...good, JWT_SECRET: '' } as any)).not.toThrow();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe('corsOptions', () => {
  it('CORS_ORIGINS 가 있으면 그 목록만 허용한다', () => {
    expect(corsOptions({ CORS_ORIGINS: 'https://a.com, https://b.com' } as any)).toEqual({ origin: ['https://a.com', 'https://b.com'], credentials: true });
  });
  it('운영에서 미설정이면 동일 오리진만 허용한다', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(corsOptions({} as any)).toEqual({ origin: false });
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
