import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockView, mockProject } = vi.hoisted(() => ({
  mockView: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  mockProject: { findFirst: vi.fn() },
}));
vi.mock('../lib/prisma', () => ({ prisma: { savedView: mockView, project: mockProject } }));

import viewRoutes from './views';

function app(role = 'MEMBER', userId = 'u1') {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { (req as any).user = { userId, name: 'U' }; (req as any).organizationId = 'org1'; (req as any).memberRole = role; next(); });
  a.use('/api/views', viewRoutes);
  return a;
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/views', () => {
  it('공유 + 본인 개인 뷰만 조회(OR 조건)', async () => {
    mockProject.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org1' });
    mockView.findMany.mockResolvedValue([]);
    await request(app()).get('/api/views?projectId=p1&type=table');
    expect(mockView.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ projectId: 'p1', type: 'table', OR: [{ isShared: true }, { createdById: 'u1' }] }),
    }));
  });
});

describe('POST /api/views', () => {
  it('공유 뷰 생성은 MEMBER 403', async () => {
    mockProject.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org1' });
    const res = await request(app('MEMBER')).post('/api/views').send({ projectId: 'p1', name: 'V', isShared: true, config: {} });
    expect(res.status).toBe(403);
  });
  it('개인 뷰는 MEMBER 가능', async () => {
    mockProject.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org1' });
    mockView.create.mockResolvedValue({ id: 'v1' });
    const res = await request(app('MEMBER')).post('/api/views').send({ projectId: 'p1', name: 'V', config: {} });
    expect(res.status).toBe(200);
  });
});

describe('PUT/DELETE /api/views', () => {
  it('타인 개인 뷰 수정 403', async () => {
    mockView.findFirst.mockResolvedValue({ id: 'v1', isShared: false, createdById: 'other' });
    const res = await request(app('MEMBER', 'u1')).put('/api/views/v1').send({ name: 'x' });
    expect(res.status).toBe(403);
  });
  it('MEMBER 가 공유/기본 전환 시도 403', async () => {
    mockView.findFirst.mockResolvedValue({ id: 'v1', isShared: true, createdById: 'u1' });
    const res = await request(app('MEMBER', 'u1')).put('/api/views/v1').send({ isDefault: true });
    expect(res.status).toBe(403);
  });
});
