import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockCycle, mockGoal } = vi.hoisted(() => ({
  mockCycle: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  mockGoal: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: { cycle: mockCycle, goal: mockGoal },
}));

import cycleRoutes from './cycles';

function createApp(memberRole = 'ADMIN', orgId = 'org1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { userId: 'u1', email: 'u1@test.com', name: 'U1' };
    (req as any).organizationId = orgId;
    (req as any).memberRole = memberRole;
    next();
  });
  app.use('/api/cycles', cycleRoutes);
  return app;
}

const Q3 = { id: 'c1', organizationId: 'org1', name: '2026 3분기', startDate: '2026-07-01', endDate: '2026-09-30' };

const goalRows = [
  { id: 'g-in', title: '3분기 내', startDate: '2026-07-10', dueDate: '2026-08-20', project: { name: 'P1' } },
  { id: 'g-straddle', title: '분기 걸침', startDate: '2026-06-01', dueDate: '2026-07-05', project: { name: 'P1' } },
  { id: 'g-out', title: '상반기', startDate: '2026-01-01', dueDate: '2026-06-30', project: { name: 'P2' } },
  { id: 'g-nodate', title: '날짜 없음', startDate: null, dueDate: null, project: { name: 'P2' } },
];

describe('Cycles 일괄 배정 라우트', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('GET /:id/unassigned-overlaps', () => {
    it('기간이 겹치는 미배정 목표만 반환 (겹침·미배정 필터)', async () => {
      mockCycle.findFirst.mockResolvedValue(Q3);
      mockGoal.findMany.mockResolvedValue(goalRows);

      const res = await request(createApp()).get('/api/cycles/c1/unassigned-overlaps');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.goals.map((g: any) => g.id)).toEqual(['g-in', 'g-straddle']);
      expect(res.body.goals[0].projectName).toBe('P1');
      // 미배정(cycleId: null) + 조직 스코프 조건으로 조회했는지
      expect(mockGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cycleId: null, project: { organizationId: 'org1' } },
        })
      );
    });

    it('타 조직 사이클이면 404 (조직 스코프)', async () => {
      mockCycle.findFirst.mockResolvedValue(null);
      const res = await request(createApp()).get('/api/cycles/other-org-cycle/unassigned-overlaps');
      expect(res.status).toBe(404);
      expect(mockCycle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'other-org-cycle', organizationId: 'org1' } })
      );
    });

    it('MEMBER는 403 (RBAC)', async () => {
      const res = await request(createApp('MEMBER')).get('/api/cycles/c1/unassigned-overlaps');
      expect(res.status).toBe(403);
      expect(mockCycle.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('POST /:id/assign-overlaps', () => {
    it('겹치는 미배정 목표를 일괄 배정하고 실제 갱신 수 반환', async () => {
      mockCycle.findFirst.mockResolvedValue(Q3);
      mockGoal.findMany.mockResolvedValue(goalRows);
      mockGoal.updateMany.mockResolvedValue({ count: 2 });

      const res = await request(createApp()).post('/api/cycles/c1/assign-overlaps');

      expect(res.status).toBe(200);
      expect(res.body.assigned).toBe(2);
      expect(mockGoal.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['g-in', 'g-straddle'] }, cycleId: null },
        data: { cycleId: 'c1' },
      });
    });

    it('goalIds가 오면 서버 계산 후보와의 교집합만 배정 (미리보기 확인분만)', async () => {
      mockCycle.findFirst.mockResolvedValue(Q3);
      mockGoal.findMany.mockResolvedValue(goalRows);
      mockGoal.updateMany.mockResolvedValue({ count: 1 });

      // g-in만 확인했고, g-out(안 겹침)·g-ghost(존재하지 않음)는 무시돼야 함
      const res = await request(createApp())
        .post('/api/cycles/c1/assign-overlaps')
        .send({ goalIds: ['g-in', 'g-out', 'g-ghost'] });

      expect(res.status).toBe(200);
      expect(res.body.assigned).toBe(1);
      expect(mockGoal.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['g-in'] }, cycleId: null },
        data: { cycleId: 'c1' },
      });
    });

    it('goalIds 교집합이 비면 updateMany 미호출, assigned 0', async () => {
      mockCycle.findFirst.mockResolvedValue(Q3);
      mockGoal.findMany.mockResolvedValue(goalRows);

      const res = await request(createApp())
        .post('/api/cycles/c1/assign-overlaps')
        .send({ goalIds: ['g-out'] });

      expect(res.status).toBe(200);
      expect(res.body.assigned).toBe(0);
      expect(mockGoal.updateMany).not.toHaveBeenCalled();
    });

    it('레이스로 실제 갱신 수가 후보보다 적으면 그 값을 반환', async () => {
      mockCycle.findFirst.mockResolvedValue(Q3);
      mockGoal.findMany.mockResolvedValue(goalRows);
      // 후보 2건 중 1건이 그 사이 다른 사이클에 배정됨(cycleId: null 조건 탈락)
      mockGoal.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(createApp()).post('/api/cycles/c1/assign-overlaps');
      expect(res.body.assigned).toBe(1);
    });

    it('겹치는 목표가 없으면 updateMany를 호출하지 않음', async () => {
      mockCycle.findFirst.mockResolvedValue(Q3);
      mockGoal.findMany.mockResolvedValue([goalRows[2], goalRows[3]]);

      const res = await request(createApp()).post('/api/cycles/c1/assign-overlaps');

      expect(res.status).toBe(200);
      expect(res.body.assigned).toBe(0);
      expect(mockGoal.updateMany).not.toHaveBeenCalled();
    });

    it('타 조직 사이클이면 404, MEMBER는 403', async () => {
      mockCycle.findFirst.mockResolvedValue(null);
      expect((await request(createApp()).post('/api/cycles/x/assign-overlaps')).status).toBe(404);
      expect((await request(createApp('MEMBER')).post('/api/cycles/c1/assign-overlaps')).status).toBe(403);
    });
  });
});
