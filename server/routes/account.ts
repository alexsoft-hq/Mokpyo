// 계정 자체에 대한 작업: 내 데이터 내보내기, 계정 삭제. /api/auth/account 에 마운트(JWT 필요).
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/auth/account/export — 내 프로필·소속·최근 활동을 JSON 으로 (개인정보 이동권)
router.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, picture: true, isEmailVerified: true, createdAt: true, updatedAt: true },
    });
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      select: { role: true, createdAt: true, organization: { select: { id: true, name: true, slug: true } } },
    });
    const [ownedGoals, comments, checkIns, auditLogs] = await Promise.all([
      prisma.goalOwner.findMany({ where: { userId }, select: { goal: { select: { id: true, title: true, projectId: true } } } }),
      prisma.comment.findMany({ where: { authorId: userId }, select: { id: true, goalId: true, body: true, createdAt: true } }),
      prisma.checkIn.findMany({ where: { userId }, select: { id: true, goalId: true, createdAt: true } }),
      prisma.auditLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 1000, select: { action: true, entityType: true, entityTitle: true, summary: true, createdAt: true } }),
    ]);
    res.setHeader('Content-Disposition', `attachment; filename="mokpyo-account-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      user,
      memberships: memberships.map((m) => ({ role: m.role, joinedAt: m.createdAt, workspace: m.organization })),
      ownedGoals: ownedGoals.map((o) => o.goal),
      comments,
      checkIns,
      recentActivity: auditLogs,
    });
  } catch (error) {
    console.error('Account export error:', error);
    res.status(500).json({ error: '내보내기에 실패했습니다.' });
  }
});

/**
 * DELETE /api/auth/account — 계정 삭제.
 * body: { password?: string; confirmEmail?: string }
 * - 비밀번호 계정은 password 필수, Google 전용 계정은 confirmEmail 이 본인 이메일과 일치해야 한다.
 * - 다른 멤버가 있는 워크스페이스의 유일한 소유자면 거부(소유권 이전 필요).
 * - 본인만 있는 워크스페이스는 함께 삭제한다.
 */
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { password, confirmEmail } = (req.body || {}) as { password?: string; confirmEmail?: string };
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    if (user.passwordHash) {
      if (!password) return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    } else if ((confirmEmail || '').trim().toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json({ error: '확인을 위해 계정 이메일을 정확히 입력해주세요.' });
    }

    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: { include: { members: { select: { userId: true, role: true } } } } },
    });

    const blocking: string[] = [];
    const soloOrgIds: string[] = [];
    for (const m of memberships) {
      const others = m.organization.members.filter((x) => x.userId !== userId);
      if (others.length === 0) {
        soloOrgIds.push(m.organizationId);
        continue;
      }
      if (m.role === 'OWNER' && !others.some((x) => x.role === 'OWNER')) {
        blocking.push(m.organization.name);
      }
    }
    if (blocking.length > 0) {
      return res.status(409).json({
        error: `다음 워크스페이스의 유일한 소유자입니다. 다른 멤버를 소유자로 지정한 뒤 다시 시도해주세요: ${blocking.join(', ')}`,
        workspaces: blocking,
      });
    }

    await prisma.$transaction(async (tx) => {
      if (soloOrgIds.length > 0) {
        await tx.organization.deleteMany({ where: { id: { in: soloOrgIds } } });
      }
      // 이름은 목표 담당자 표시용으로 남고(GoalOwner.userId 는 SetNull), 개인 식별 정보는 사용자 행과 함께 사라진다.
      await tx.user.delete({ where: { id: userId } });
    });

    res.json({ success: true, deletedWorkspaces: soloOrgIds.length });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: '계정 삭제에 실패했습니다.' });
  }
});

export default router;
