import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockGoal, mockComment, mockOrgMember, mockNotification } = vi.hoisted(() => ({
  mockGoal: { findFirst: vi.fn() },
  mockComment: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockOrgMember: { findMany: vi.fn() },
  mockNotification: { createMany: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: { goal: mockGoal, comment: mockComment, organizationMember: mockOrgMember, notification: mockNotification },
}));

import commentRoutes from './comments';

function app(role = 'MEMBER', userId = 'u1') {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as any).user = { userId, email: 'u@t.com', name: '작성자' };
    (req as any).organizationId = 'org1';
    (req as any).memberRole = role;
    (req as any).audit = vi.fn();
    next();
  });
  a.use('/api/goals/:goalId/comments', commentRoutes);
  return a;
}

beforeEach(() => vi.clearAllMocks());

describe('POST comments', () => {
  it('타 조직 목표면 404', async () => {
    mockGoal.findFirst.mockResolvedValue(null);
    const res = await request(app()).post('/api/goals/g1/comments').send({ body: '안녕' });
    expect(res.status).toBe(404);
  });

  it('빈 본문 400', async () => {
    const res = await request(app()).post('/api/goals/g1/comments').send({ body: '  ' });
    expect(res.status).toBe(400);
  });

  it('멘션 마커가 있으면 조직 멤버에게 알림 생성', async () => {
    mockGoal.findFirst.mockResolvedValue({ id: 'g1', title: '목표', projectId: 'p1' });
    mockComment.create.mockResolvedValue({ id: 'c1', goalId: 'g1', authorId: 'u1', authorName: '작성자', body: '@[을](u2) 확인', parentId: null, createdAt: new Date(), author: { id: 'u1', name: '작성자', picture: null } });
    mockOrgMember.findMany.mockResolvedValue([{ userId: 'u2' }]);
    mockNotification.createMany.mockResolvedValue({ count: 1 });
    const res = await request(app()).post('/api/goals/g1/comments').send({ body: '@[을](u2) 확인' });
    expect(res.status).toBe(200);
    expect(mockNotification.createMany).toHaveBeenCalled();
    const arg = mockNotification.createMany.mock.calls[0][0];
    expect(arg.data[0]).toMatchObject({ recipientId: 'u2', type: 'mention', entityType: 'goal', entityId: 'g1' });
  });

  it('답글에 답글(2단계)은 400', async () => {
    mockGoal.findFirst.mockResolvedValue({ id: 'g1', title: '목표', projectId: 'p1' });
    mockComment.findFirst.mockResolvedValue({ id: 'reply1', goalId: 'g1', parentId: 'top1' }); // 이미 답글
    const res = await request(app()).post('/api/goals/g1/comments').send({ body: '답', parentId: 'reply1' });
    expect(res.status).toBe(400);
  });
});

describe('PUT/DELETE comments RBAC', () => {
  it('본인 아닌 댓글 수정 403', async () => {
    mockComment.findFirst.mockResolvedValue({ id: 'c1', authorId: 'other', deletedAt: null });
    const res = await request(app('MEMBER', 'u1')).put('/api/goals/g1/comments/c1').send({ body: '수정' });
    expect(res.status).toBe(403);
  });

  it('ADMIN 은 타인 댓글 삭제 가능(soft delete)', async () => {
    mockComment.findFirst.mockResolvedValue({ id: 'c1', authorId: 'other', deletedAt: null });
    mockComment.update.mockResolvedValue({});
    const res = await request(app('ADMIN', 'u1')).delete('/api/goals/g1/comments/c1');
    expect(res.status).toBe(200);
    expect(mockComment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.anything() }) }));
  });
});
