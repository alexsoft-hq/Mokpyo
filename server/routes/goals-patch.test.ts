import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockGoal, mockGoalOwner, mockOrgMember } = vi.hoisted(() => ({
  mockGoal: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  mockGoalOwner: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  mockOrgMember: { findMany: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: { goal: mockGoal, goalOwner: mockGoalOwner, organizationMember: mockOrgMember, cycle: { findFirst: vi.fn() }, notification: { createMany: vi.fn() } },
}));
// statusSync / automation 은 부수효과만 — 무해 stub
vi.mock('../lib/statusSync', () => ({ resolveInitialStatus: vi.fn(), syncStatusFromFlags: vi.fn() }));
vi.mock('../services/automation/engine', () => ({ emitDomainEvent: vi.fn() }));
vi.mock('../lib/notifications', () => ({ createAssignmentNotifications: vi.fn() }));

import goalsPatchRoutes from './goals-patch';

function app() {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { (req as any).user = { userId: 'u1', name: 'U1' }; (req as any).organizationId = 'org1'; (req as any).memberRole = 'MEMBER'; (req as any).audit = vi.fn(); next(); });
  a.use('/api', goalsPatchRoutes);
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGoal.findFirst.mockResolvedValue({ id: 'g1', version: 0, projectId: 'p1', title: 'G', statusId: 'ip', progress: 30, completed: false, onHold: false });
  mockGoal.update.mockResolvedValue({});
  mockGoal.findUnique.mockResolvedValue({ id: 'g1', title: 'G', projectId: 'p1', owner: '갑', goalOwners: [{ ownerName: '갑', order: 0 }, { ownerName: '을', order: 1 }], categories: [], subGoals: [], notes: [], attachments: [] });
  mockGoalOwner.findMany.mockResolvedValue([]);
  mockGoalOwner.deleteMany.mockResolvedValue({});
  mockGoalOwner.createMany.mockResolvedValue({});
  mockOrgMember.findMany.mockResolvedValue([{ userId: 'u2', user: { name: '갑' } }, { userId: 'u3', user: { name: '을' } }]);
});

describe('PATCH /api/goals/:id — owners (코드리뷰 A: 담당자 데이터 손실 회귀 방지)', () => {
  it('owners 배열이 오면 goalOwners 관계를 교체(delete+create)', async () => {
    const res = await request(app()).patch('/api/goals/g1').send({ owners: ['갑', '을'], owner: '갑' });
    expect(res.status).toBe(200);
    expect(mockGoalOwner.deleteMany).toHaveBeenCalledWith({ where: { goalId: 'g1' } });
    expect(mockGoalOwner.createMany).toHaveBeenCalled();
    const created = mockGoalOwner.createMany.mock.calls[0][0].data;
    expect(created.map((o: any) => o.ownerName)).toEqual(['갑', '을']);
    // 이름→userId 링크도 채워짐
    expect(created[0].userId).toBe('u2');
  });

  it('owners 미포함이면 goalOwners 는 건드리지 않음', async () => {
    const res = await request(app()).patch('/api/goals/g1').send({ title: '새 제목' });
    expect(res.status).toBe(200);
    expect(mockGoalOwner.deleteMany).not.toHaveBeenCalled();
  });

  it('version 불일치 → 409', async () => {
    const res = await request(app()).patch('/api/goals/g1').send({ title: 'x', version: 99 });
    expect(res.status).toBe(409);
  });
});
