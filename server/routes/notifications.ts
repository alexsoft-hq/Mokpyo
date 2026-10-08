import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/notifications — 현재 사용자·조직 스코프 알림 목록
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const notifications = await prisma.notification.findMany({
      where: { recipientId: req.user!.userId, organizationId: req.organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count — 안 읽은 알림 수
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { recipientId: req.user!.userId, organizationId: req.organizationId, read: false },
    });
    res.json({ count });
  } catch (error) {
    console.error('Error counting notifications:', error);
    res.status(500).json({ error: 'Failed to count notifications' });
  }
});

// POST /api/notifications/:id/read — 단건 읽음 처리 (본인 것만)
router.post('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, recipientId: req.user!.userId },
      data: { read: true },
    });
    if (result.count === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// POST /api/notifications/read-all — 현재 조직의 모든 알림 읽음 처리
router.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { recipientId: req.user!.userId, organizationId: req.organizationId, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications read' });
  }
});

export default router;
