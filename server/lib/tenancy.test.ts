import { describe, it, expect, vi } from 'vitest';

// prisma 모듈 로드 시 실제 PrismaClient 생성을 피하려고 mock (requireRole은 prisma를 쓰지 않음)
vi.mock('./prisma', () => ({ prisma: {} }));

import { requireRole } from './tenancy';

function mockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('requireRole', () => {
  it('허용 역할이면 true, 응답 미발생', () => {
    const res = mockRes();
    expect(requireRole({ memberRole: 'OWNER' } as any, res, ['OWNER', 'ADMIN'])).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('허용되지 않은 역할이면 403 후 false', () => {
    const res = mockRes();
    expect(requireRole({ memberRole: 'MEMBER' } as any, res, ['OWNER', 'ADMIN'])).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('역할이 없으면 403 후 false', () => {
    const res = mockRes();
    expect(requireRole({} as any, res, ['OWNER'])).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
