import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockStatusLabel, mockGoal, mockProject, mockField, mockOrgMember } = vi.hoisted(() => ({
  mockStatusLabel: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), createMany: vi.fn() },
  mockGoal: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  mockProject: { findFirst: vi.fn() },
  mockField: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  mockOrgMember: { findMany: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    statusLabel: mockStatusLabel,
    goal: mockGoal,
    project: mockProject,
    customFieldDefinition: mockField,
    organizationMember: mockOrgMember,
  },
}));

import fieldsRoutes from './fields';

function createApp(memberRole = 'ADMIN', orgId = 'org1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { userId: 'u1', email: 'u1@t.com', name: 'U1' };
    (req as any).organizationId = orgId;
    (req as any).memberRole = memberRole;
    (req as any).audit = vi.fn();
    next();
  });
  app.use('/api', fieldsRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStatusLabel.count.mockResolvedValue(5);
});

describe('POST /api/status-labels', () => {
  it('MEMBER 는 403 (RBAC)', async () => {
    const res = await request(createApp('MEMBER')).post('/api/status-labels').send({ name: '검토', color: '#fff' });
    expect(res.status).toBe(403);
    expect(mockStatusLabel.create).not.toHaveBeenCalled();
  });

  it('ADMIN 생성 시 kind=active 강제', async () => {
    mockStatusLabel.create.mockResolvedValue({ id: 'l_new', kind: 'active' });
    const res = await request(createApp('ADMIN')).post('/api/status-labels').send({ name: '검토', color: '#abc' });
    expect(res.status).toBe(200);
    expect(mockStatusLabel.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'active', isSystem: false, organizationId: 'org1' }) })
    );
  });
});

describe('DELETE /api/status-labels/:id', () => {
  it('시스템 라벨 삭제 거부(400)', async () => {
    mockStatusLabel.findFirst.mockResolvedValueOnce({ id: 'l_done', organizationId: 'org1', name: '완료', isSystem: true });
    const res = await request(createApp('ADMIN')).delete('/api/status-labels/l_done');
    expect(res.status).toBe(400);
    expect(mockStatusLabel.delete).not.toHaveBeenCalled();
  });

  it('비시스템 라벨 삭제 전 goal 을 시작 전으로 재배정(orphan 방지)', async () => {
    // 1st findFirst: 삭제 대상(위험), 2nd findFirst: 시작 전 앵커
    mockStatusLabel.findFirst
      .mockResolvedValueOnce({ id: 'l_risk', organizationId: 'org1', name: '위험', isSystem: false })
      .mockResolvedValueOnce({ id: 'l_ns', organizationId: 'org1', name: '시작 전' });
    mockGoal.updateMany.mockResolvedValue({ count: 3 });
    mockStatusLabel.delete.mockResolvedValue({});
    const res = await request(createApp('ADMIN')).delete('/api/status-labels/l_risk');
    expect(res.status).toBe(200);
    expect(mockGoal.updateMany).toHaveBeenCalledWith({
      where: { statusId: 'l_risk' },
      data: { statusId: 'l_ns', completed: false, onHold: false },
    });
    expect(mockStatusLabel.delete).toHaveBeenCalledWith({ where: { id: 'l_risk' } });
  });

  it('타 조직 라벨이면 404', async () => {
    mockStatusLabel.findFirst.mockResolvedValueOnce(null);
    const res = await request(createApp('ADMIN')).delete('/api/status-labels/foreign');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/goals/:id/status', () => {
  it('version 불일치 → 409 (낙관적 잠금)', async () => {
    mockGoal.findFirst.mockResolvedValue({ id: 'g1', version: 5, projectId: 'p1', statusId: 'l_ns', title: 'G' });
    const res = await request(createApp('MEMBER')).put('/api/goals/g1/status').send({ statusId: 'l_done', version: 3 });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/projects/:projectId/fields', () => {
  it('유효하지 않은 타입 거부(400)', async () => {
    mockProject.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org1' });
    const res = await request(createApp('ADMIN')).post('/api/projects/p1/fields').send({ name: 'x', type: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('priority 는 옵션 미지정 시 프리셋 시드', async () => {
    mockProject.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org1' });
    mockField.count.mockResolvedValue(0);
    mockField.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'f1', ...data }));
    const res = await request(createApp('ADMIN')).post('/api/projects/p1/fields').send({ name: '우선순위', type: 'priority' });
    expect(res.status).toBe(200);
    expect(res.body.config.options.length).toBe(5);
  });
});
