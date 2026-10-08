import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockRule, mockProject, mockExec } = vi.hoisted(() => ({
  mockRule: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  mockProject: { findFirst: vi.fn() },
  mockExec: { findMany: vi.fn() },
}));
vi.mock('../lib/prisma', () => ({ prisma: { automationRule: mockRule, project: mockProject, automationExecution: mockExec } }));

import automationRoutes from './automations';

function app(role = 'ADMIN') {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { (req as any).user = { userId: 'u1', name: 'U' }; (req as any).organizationId = 'org1'; (req as any).memberRole = role; next(); });
  a.use('/api/automations', automationRoutes);
  return a;
}
beforeEach(() => vi.clearAllMocks());

describe('POST /api/automations', () => {
  it('MEMBER 403', async () => {
    const res = await request(app('MEMBER')).post('/api/automations').send({ projectId: 'p1', name: 'R', triggerType: 'goal_created', actions: [{ type: 'notify_person', config: {} }] });
    expect(res.status).toBe(403);
  });
  it('유효하지 않은 트리거 400', async () => {
    mockProject.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org1' });
    const res = await request(app('ADMIN')).post('/api/automations').send({ projectId: 'p1', name: 'R', triggerType: 'bogus', actions: [{ type: 'notify_person', config: {} }] });
    expect(res.status).toBe(400);
  });
  it('액션 없으면 400', async () => {
    mockProject.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org1' });
    const res = await request(app('ADMIN')).post('/api/automations').send({ projectId: 'p1', name: 'R', triggerType: 'goal_created', actions: [] });
    expect(res.status).toBe(400);
  });
  it('유효하지 않은 액션 타입 400', async () => {
    mockProject.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org1' });
    const res = await request(app('ADMIN')).post('/api/automations').send({ projectId: 'p1', name: 'R', triggerType: 'goal_created', actions: [{ type: 'nuke', config: {} }] });
    expect(res.status).toBe(400);
  });
  it('정상 생성 200', async () => {
    mockProject.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org1' });
    mockRule.create.mockResolvedValue({ id: 'r1' });
    const res = await request(app('ADMIN')).post('/api/automations').send({ projectId: 'p1', name: 'R', triggerType: 'status_changed', triggerConfig: { toStatusId: 'done' }, actions: [{ type: 'notify_person', config: { userIds: ['u2'] } }] });
    expect(res.status).toBe(200);
  });
});

describe('toggle/delete', () => {
  it('toggle MEMBER 403', async () => {
    const res = await request(app('MEMBER')).post('/api/automations/r1/toggle').send({ enabled: false });
    expect(res.status).toBe(403);
  });
});
