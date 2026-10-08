import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { requireRole, findProjectInOrg } from '../lib/tenancy';

const router = Router();

// GET /api/views?projectId=&type= — 공유 뷰 + 요청자 개인 뷰
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const type = req.query.type as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    if (!(await findProjectInOrg(projectId, req.organizationId!))) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const views = await prisma.savedView.findMany({
      where: {
        projectId,
        ...(type ? { type } : {}),
        OR: [{ isShared: true }, { createdById: req.user!.userId }],
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(views);
  } catch (error) {
    console.error('Error fetching views:', error);
    res.status(500).json({ error: 'Failed to fetch views' });
  }
});

// POST /api/views — 개인 뷰는 누구나, 공유 뷰는 ADMIN/OWNER
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, name, type, isShared, config } = req.body;
    if (!projectId || !name) return res.status(400).json({ error: 'projectId, name은 필수입니다.' });
    if (!(await findProjectInOrg(projectId, req.organizationId!))) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (isShared && !requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const view = await prisma.savedView.create({
      data: {
        organizationId: req.organizationId!,
        projectId,
        createdById: req.user!.userId,
        name,
        type: type || 'table',
        isShared: !!isShared,
        config: config && typeof config === 'object' ? config : {},
      },
    });
    res.json(view);
  } catch (error) {
    console.error('Error creating view:', error);
    res.status(500).json({ error: 'Failed to create view' });
  }
});

// PUT /api/views/:id — 개인: 생성자만 / 공유: 생성자 또는 ADMIN. isDefault 토글은 ADMIN.
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const view = await prisma.savedView.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!view) return res.status(404).json({ error: 'View not found' });

    const isAdmin = req.memberRole === 'OWNER' || req.memberRole === 'ADMIN';
    const isCreator = view.createdById === req.user!.userId;
    if (view.isShared ? !(isCreator || isAdmin) : !isCreator) {
      return res.status(403).json({ error: '수정 권한이 없습니다.' });
    }

    const { name, config, isShared, isDefault, order } = req.body;
    // 공유/기본 전환은 ADMIN 만
    if ((isShared !== undefined || isDefault !== undefined) && !isAdmin) {
      return res.status(403).json({ error: '공유/기본 설정은 관리자만 변경할 수 있습니다.' });
    }
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (config !== undefined && typeof config === 'object') data.config = config;
    if (order !== undefined) data.order = order;
    if (isShared !== undefined) data.isShared = !!isShared;
    if (isDefault !== undefined) data.isDefault = !!isDefault;
    const updated = await prisma.savedView.update({ where: { id: view.id }, data });
    res.json(updated);
  } catch (error) {
    console.error('Error updating view:', error);
    res.status(500).json({ error: 'Failed to update view' });
  }
});

// DELETE /api/views/:id — 개인: 생성자만 / 공유: 생성자 또는 ADMIN
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const view = await prisma.savedView.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!view) return res.status(404).json({ error: 'View not found' });
    const isAdmin = req.memberRole === 'OWNER' || req.memberRole === 'ADMIN';
    const isCreator = view.createdById === req.user!.userId;
    if (view.isShared ? !(isCreator || isAdmin) : !isCreator) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }
    await prisma.savedView.delete({ where: { id: view.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting view:', error);
    res.status(500).json({ error: 'Failed to delete view' });
  }
});

export default router;
