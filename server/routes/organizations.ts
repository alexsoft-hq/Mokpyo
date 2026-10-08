import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getOrgPlanSummary } from '../lib/plans';
import { buildSampleProject } from '../lib/sampleData';

const router = Router();

// Helper: generate URL-safe slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'workspace';
}

// Helper: ensure slug uniqueness
async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// Helper: check membership with role
async function checkMembership(orgId: string, userId: string, requiredRoles?: string[]) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (!membership) return null;
  if (requiredRoles && !requiredRoles.includes(membership.role)) return null;
  return membership;
}

// GET /api/organizations — List user's organizations
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: req.user!.userId },
      include: {
        organization: {
          include: {
            _count: { select: { members: true, projects: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      memberCount: m.organization._count.members,
      projectCount: m.organization._count.projects,
      createdAt: m.organization.createdAt,
    }));

    res.json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// POST /api/organizations — Create organization
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const baseSlug = generateSlug(name.trim());
    const slug = await ensureUniqueSlug(baseSlug);

    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug,
        members: {
          create: {
            userId: req.user!.userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        _count: { select: { members: true, projects: true } },
      },
    });

    res.status(201).json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: 'OWNER',
      memberCount: organization._count.members,
      projectCount: organization._count.projects,
      createdAt: organization.createdAt,
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// GET /api/organizations/:id — Get organization details
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const membership = await checkMembership(id, req.user!.userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { members: true, projects: true } },
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const billing = await getOrgPlanSummary(organization.id, organization.plan);

    res.json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: membership.role,
      memberCount: organization._count.members,
      projectCount: organization._count.projects,
      createdAt: organization.createdAt,
      billing,
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// PUT /api/organizations/:id — Update organization
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const membership = await checkMembership(id, req.user!.userId, ['OWNER', 'ADMIN']);
    if (!membership) {
      return res.status(403).json({ error: 'Admin or owner access required' });
    }

    const { name, slug: newSlug } = req.body;
    const updateData: any = {};

    if (name !== undefined) updateData.name = name.trim();
    if (newSlug !== undefined) {
      const slug = await ensureUniqueSlug(newSlug.trim().toLowerCase(), id);
      updateData.slug = slug;
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    res.json(organization);
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// DELETE /api/organizations/:id — Delete organization (OWNER only)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const membership = await checkMembership(id, req.user!.userId, ['OWNER']);
    if (!membership) {
      return res.status(403).json({ error: 'Owner access required' });
    }

    await prisma.organization.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// GET /api/organizations/:id/members — List members
router.get('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const membership = await checkMembership(id, req.user!.userId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: id },
      include: {
        user: { select: { id: true, name: true, email: true, picture: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });

    res.json(members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      picture: m.user.picture,
      role: m.role,
      createdAt: m.createdAt,
    })));
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// PUT /api/organizations/:id/members/:userId — Update member role
router.put('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    const membership = await checkMembership(id, req.user!.userId, ['OWNER', 'ADMIN']);
    if (!membership) {
      return res.status(403).json({ error: 'Admin or owner access required' });
    }

    // Validate role value (invalid role would otherwise throw a 500 at the DB layer)
    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Cannot change own role
    if (userId === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Only OWNER can set ADMIN/OWNER roles
    if ((role === 'OWNER' || role === 'ADMIN') && membership.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owner can assign admin/owner roles' });
    }

    const targetMembership = await checkMembership(id, userId);
    if (!targetMembership) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // ADMIN cannot modify OWNER or other ADMIN (only OWNER can)
    if (membership.role === 'ADMIN' && targetMembership.role !== 'MEMBER') {
      return res.status(403).json({ error: 'Admin cannot modify other admins or owners' });
    }

    // Prevent demoting the last OWNER (would orphan the organization)
    if (targetMembership.role === 'OWNER' && role !== 'OWNER') {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: id, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ error: '마지막 소유자의 역할은 변경할 수 없습니다. 다른 멤버를 소유자로 지정한 뒤 시도하세요.' });
      }
    }

    const updated = await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: id, userId } },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, picture: true } },
      },
    });

    res.json({
      id: updated.id,
      userId: updated.user.id,
      name: updated.user.name,
      email: updated.user.email,
      picture: updated.user.picture,
      role: updated.role,
      createdAt: updated.createdAt,
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /api/organizations/:id/members/:userId — Remove member
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;

    const membership = await checkMembership(id, req.user!.userId, ['OWNER', 'ADMIN']);
    if (!membership) {
      return res.status(403).json({ error: 'Admin or owner access required' });
    }

    // Cannot remove self (use leave instead)
    if (userId === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot remove yourself. Use leave instead.' });
    }

    // ADMIN cannot remove OWNER or other ADMIN
    const targetMembership = await checkMembership(id, userId);
    if (targetMembership && membership.role === 'ADMIN' && targetMembership.role !== 'MEMBER') {
      return res.status(403).json({ error: 'Admin cannot remove other admins or owners' });
    }

    // Prevent removing the last OWNER (would orphan the organization)
    if (targetMembership && targetMembership.role === 'OWNER') {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: id, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ error: '마지막 소유자는 제거할 수 없습니다.' });
      }
    }

    await prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId: id, userId } },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// POST /api/organizations/:id/leave — Leave organization (self-service)
router.post('/:id/leave', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const membership = await checkMembership(id, req.user!.userId);
    if (!membership) {
      return res.status(404).json({ error: 'Not a member of this organization' });
    }

    // Last OWNER cannot leave (would orphan the organization)
    if (membership.role === 'OWNER') {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: id, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ error: '마지막 소유자는 워크스페이스를 나갈 수 없습니다. 다른 멤버를 소유자로 지정하거나 워크스페이스를 삭제하세요.' });
      }
    }

    await prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId: id, userId: req.user!.userId } },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving organization:', error);
    res.status(500).json({ error: 'Failed to leave organization' });
  }
});

// GET /api/organizations/:id/export — 워크스페이스 전체 데이터 JSON 내보내기 (OWNER/ADMIN)
router.get('/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const membership = await checkMembership(id, req.user!.userId, ['OWNER', 'ADMIN']);
    if (!membership) {
      return res.status(403).json({ error: 'Admin or owner access required' });
    }
    const organization = await prisma.organization.findUnique({ where: { id }, select: { id: true, name: true, slug: true, plan: true, createdAt: true } });
    if (!organization) return res.status(404).json({ error: 'Organization not found' });

    const [members, statusLabels, cycles, projects, savedViews, automationRules, auditLogs] = await Promise.all([
      prisma.organizationMember.findMany({ where: { organizationId: id }, select: { role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } } }),
      prisma.statusLabel.findMany({ where: { organizationId: id }, orderBy: { order: 'asc' } }),
      prisma.cycle.findMany({ where: { organizationId: id }, orderBy: { startDate: 'asc' } }),
      prisma.project.findMany({
        where: { organizationId: id },
        include: {
          categories: true,
          customFieldDefs: true,
          goals: {
            orderBy: { order: 'asc' },
            include: {
              categories: { select: { id: true, name: true } },
              goalOwners: { orderBy: { order: 'asc' }, select: { ownerName: true, userId: true } },
              subGoals: { orderBy: { order: 'asc' }, include: { subGoalOwners: { select: { ownerName: true, userId: true } } } },
              notes: true,
              comments: { where: { deletedAt: null }, select: { id: true, authorName: true, body: true, parentId: true, createdAt: true } },
              checkIns: true,
              attachments: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } },
            },
          },
        },
      }),
      prisma.savedView.findMany({ where: { organizationId: id } }),
      prisma.automationRule.findMany({ where: { organizationId: id } }),
      // 감사 로그: 최근 20,000건(변경 이력 이관·컴플라이언스 제출용)
      prisma.auditLog.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 20000,
        select: { id: true, action: true, entityType: true, entityId: true, entityTitle: true, goalId: true, projectId: true, summary: true, changes: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    res.setHeader('Content-Disposition', `attachment; filename="mokpyo-${organization.slug}-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      format: 'mokpyo-export/1',
      exportedAt: new Date().toISOString(),
      workspace: organization,
      members: members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.createdAt })),
      statusLabels,
      cycles,
      projects,
      savedViews,
      automationRules,
      auditLogs,
    });
  } catch (error) {
    console.error('Error exporting organization:', error);
    res.status(500).json({ error: '내보내기에 실패했습니다.' });
  }
});

// POST /api/organizations/:id/sample-data — 온보딩용 샘플 프로젝트 생성 (OWNER/ADMIN, 멱등)
router.post('/:id/sample-data', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const membership = await checkMembership(id, req.user!.userId, ['OWNER', 'ADMIN']);
    if (!membership) {
      return res.status(403).json({ error: 'Admin or owner access required' });
    }
    const result = await buildSampleProject(id, req.user!.userId, req.user!.name);
    res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    console.error('Error creating sample data:', error);
    res.status(500).json({ error: '샘플 데이터 생성에 실패했습니다.' });
  }
});

export default router;
