import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockNotif } = vi.hoisted(() => ({
  mockNotif: {
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: { notification: mockNotif },
}));

import notificationRoutes from './notifications';

function createApp(userId = 'u1', orgId = 'org1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { userId, email: 'u1@test.com', name: 'U1' };
    (req as any).organizationId = orgId;
    next();
  });
  app.use('/api/notifications', notificationRoutes);
  return app;
}

describe('Notifications 라우트', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET / — 본인+조직 스코프로 조회', async () => {
    mockNotif.findMany.mockResolvedValue([{ id: 'n1', type: 'GOAL_ASSIGNED' }]);
    const res = await request(createApp()).get('/api/notifications');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockNotif.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recipientId: 'u1', organizationId: 'org1' } })
    );
  });

  it('GET /unread-count — 안읽음 수 반환', async () => {
    mockNotif.count.mockResolvedValue(3);
    const res = await request(createApp()).get('/api/notifications/unread-count');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  it('POST /:id/read — 본인 알림이면 200', async () => {
    mockNotif.updateMany.mockResolvedValue({ count: 1 });
    const res = await request(createApp()).post('/api/notifications/n1/read');
    expect(res.status).toBe(200);
    expect(mockNotif.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'n1', recipientId: 'u1' } })
    );
  });

  it('POST /:id/read — 남의 알림(매칭 0)이면 404', async () => {
    mockNotif.updateMany.mockResolvedValue({ count: 0 });
    const res = await request(createApp()).post('/api/notifications/other/read');
    expect(res.status).toBe(404);
  });

  it('POST /read-all — 조직 내 전체 읽음', async () => {
    mockNotif.updateMany.mockResolvedValue({ count: 5 });
    const res = await request(createApp()).post('/api/notifications/read-all');
    expect(res.status).toBe(200);
  });
});
