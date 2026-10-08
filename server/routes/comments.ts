import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { requireRole, findGoalInOrg } from '../lib/tenancy';
import { parseMentionUserIds } from '../lib/mentions';
import { createMentionNotifications } from '../lib/notifications';

// mergeParams: /api/goals/:goalId/comments 로 마운트되므로 부모 파라미터 접근 필요
const router = Router({ mergeParams: true });

function authorInfo(c: any) {
  return {
    id: c.id,
    goalId: c.goalId,
    authorId: c.authorId,
    authorName: c.authorName,
    author: c.author ? { id: c.author.id, name: c.author.name, picture: c.author.picture } : null,
    parentId: c.parentId,
    body: c.deletedAt ? '' : c.body,
    deleted: !!c.deletedAt,
    editedAt: c.editedAt,
    createdAt: c.createdAt,
  };
}

// GET /api/goals/:goalId/comments — 최상위 댓글(오래된 순) + 답글 중첩
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const goalId = req.params.goalId;
    if (!(await findGoalInOrg(goalId, req.organizationId!))) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    const comments = await prisma.comment.findMany({
      where: { goalId, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, picture: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, picture: true } } },
        },
      },
    });
    res.json(comments.map((c) => ({ ...authorInfo(c), replies: c.replies.map(authorInfo) })));
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/goals/:goalId/comments { body, parentId? } — 멘션 파싱 → 알림
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const goalId = req.params.goalId;
    const { body, parentId } = req.body;
    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: '내용을 입력하세요.' });
    }
    const goal = await findGoalInOrg(goalId, req.organizationId!);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    // 1단계 답글만 허용 — parentId 가 답글(2단계)을 가리키면 거부
    if (parentId) {
      const parent = await prisma.comment.findFirst({ where: { id: parentId, goalId } });
      if (!parent) return res.status(400).json({ error: '부모 댓글을 찾을 수 없습니다.' });
      if (parent.parentId) return res.status(400).json({ error: '답글에는 다시 답글을 달 수 없습니다.' });
    }

    const comment = await prisma.comment.create({
      data: {
        goalId,
        authorId: req.user!.userId,
        authorName: req.user!.name,
        parentId: parentId ?? null,
        body: body.trim(),
      },
      include: { author: { select: { id: true, name: true, picture: true } } },
    });

    // 멘션 알림
    const mentioned = parseMentionUserIds(body);
    if (mentioned.length > 0) {
      await createMentionNotifications({
        organizationId: req.organizationId!,
        goalId,
        goalTitle: goal.title,
        mentionedUserIds: mentioned,
        actorUserId: req.user!.userId,
        actorName: req.user!.name,
      });
    }

    await (req as any).audit?.({
      action: 'CREATE', entityType: 'Comment', entityId: comment.id, entityTitle: goal.title,
      goalId, projectId: goal.projectId, summary: `목표 '${goal.title}'에 댓글 작성`,
    });

    res.json({ ...authorInfo(comment), replies: [] });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PUT /api/comments/:id { body } — 작성자 본인만
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: '내용을 입력하세요.' });
    const comment = await prisma.comment.findFirst({
      where: { id: req.params.id, goal: { project: { organizationId: req.organizationId } } },
    });
    if (!comment || comment.deletedAt) return res.status(404).json({ error: 'Comment not found' });
    if (comment.authorId !== req.user!.userId) {
      return res.status(403).json({ error: '본인 댓글만 수정할 수 있습니다.' });
    }
    const updated = await prisma.comment.update({
      where: { id: comment.id },
      data: { body: body.trim(), editedAt: new Date() },
      include: { author: { select: { id: true, name: true, picture: true } } },
    });
    res.json(authorInfo(updated));
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// DELETE /api/comments/:id — 작성자 또는 OWNER/ADMIN. soft delete
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const comment = await prisma.comment.findFirst({
      where: { id: req.params.id, goal: { project: { organizationId: req.organizationId } } },
    });
    if (!comment || comment.deletedAt) return res.status(404).json({ error: 'Comment not found' });
    const isOwnerAdmin = req.memberRole === 'OWNER' || req.memberRole === 'ADMIN';
    if (comment.authorId !== req.user!.userId && !isOwnerAdmin) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }
    await prisma.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
