import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockOrgMember, mockOrg } = vi.hoisted(() => ({
  mockOrgMember: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  mockOrg: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    organizationMember: mockOrgMember,
    organization: mockOrg,
  },
}));

import orgRoutes from './organizations';

function createApp(userId = 'requester') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { userId, email: 'req@test.com', name: 'Req' };
    next();
  });
  app.use('/api/organizations', orgRoutes);
  return app;
}

describe('Organizations 멤버 생애주기 가드', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrgMember.update.mockResolvedValue({
      id: 'm1', role: 'MEMBER', createdAt: new Date(),
      user: { id: 'target', name: 'T', email: 't@test.com', picture: null },
    });
    mockOrgMember.delete.mockResolvedValue({});
  });

  describe('PUT /:id/members/:userId (역할 변경)', () => {
    it('유효하지 않은 role 값이면 400', async () => {
      mockOrgMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' }); // 요청자
      const res = await request(createApp()).put('/api/organizations/org1/members/target').send({ role: 'SUPERADMIN' });
      expect(res.status).toBe(400);
    });

    it('ADMIN이 OWNER를 강등하려 하면 403', async () => {
      mockOrgMember.findUnique
        .mockResolvedValueOnce({ role: 'ADMIN' })   // 요청자
        .mockResolvedValueOnce({ role: 'OWNER' });  // 대상
      const res = await request(createApp()).put('/api/organizations/org1/members/target').send({ role: 'MEMBER' });
      expect(res.status).toBe(403);
    });

    it('마지막 OWNER 강등은 400', async () => {
      mockOrgMember.findUnique
        .mockResolvedValueOnce({ role: 'OWNER' })   // 요청자
        .mockResolvedValueOnce({ role: 'OWNER' });  // 대상(마지막 소유자)
      mockOrgMember.count.mockResolvedValue(1);
      const res = await request(createApp()).put('/api/organizations/org1/members/target').send({ role: 'MEMBER' });
      expect(res.status).toBe(400);
    });

    it('OWNER가 2명일 때 한 명 강등은 허용(200)', async () => {
      mockOrgMember.findUnique
        .mockResolvedValueOnce({ role: 'OWNER' })
        .mockResolvedValueOnce({ role: 'OWNER' });
      mockOrgMember.count.mockResolvedValue(2);
      const res = await request(createApp()).put('/api/organizations/org1/members/target').send({ role: 'MEMBER' });
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /:id/members/:userId (제거)', () => {
    it('마지막 OWNER 제거는 400', async () => {
      mockOrgMember.findUnique
        .mockResolvedValueOnce({ role: 'OWNER' })   // 요청자
        .mockResolvedValueOnce({ role: 'OWNER' });  // 대상
      mockOrgMember.count.mockResolvedValue(1);
      const res = await request(createApp()).delete('/api/organizations/org1/members/target');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /:id/leave', () => {
    it('비멤버의 leave는 404', async () => {
      mockOrgMember.findUnique.mockResolvedValueOnce(null);
      const res = await request(createApp()).post('/api/organizations/org1/leave');
      expect(res.status).toBe(404);
    });

    it('마지막 OWNER의 leave는 400', async () => {
      mockOrgMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' });
      mockOrgMember.count.mockResolvedValue(1);
      const res = await request(createApp()).post('/api/organizations/org1/leave');
      expect(res.status).toBe(400);
    });

    it('MEMBER의 leave는 200', async () => {
      mockOrgMember.findUnique.mockResolvedValueOnce({ role: 'MEMBER' });
      const res = await request(createApp()).post('/api/organizations/org1/leave');
      expect(res.status).toBe(200);
      expect(mockOrgMember.delete).toHaveBeenCalled();
    });
  });
});
