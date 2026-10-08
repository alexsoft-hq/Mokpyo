import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../lib/tenancy';
import { goalOverlapsCycle } from '../lib/cycleOverlap';

const router = Router();

// 사이클 기간과 겹치는 '미배정' 목표 조회 (미리보기·일괄 배정 공용).
// 사이클이 조직 소유가 아니면 null.
async function findUnassignedOverlaps(cycleId: string, organizationId: string) {
  const cycle = await prisma.cycle.findFirst({
    where: { id: cycleId, organizationId },
  });
  if (!cycle) return null;
  const goals = await prisma.goal.findMany({
    where: { cycleId: null, project: { organizationId } },
    select: {
      id: true,
      title: true,
      startDate: true,
      dueDate: true,
      project: { select: { name: true } },
    },
  });
  return { cycle, goals: goals.filter((g) => goalOverlapsCycle(g, cycle)) };
}

// resolveOrganization 미들웨어 뒤에 마운트됨 → req.organizationId / req.memberRole 사용 가능.

// GET /api/cycles — 조직의 목표 주기 목록 (최신 시작일 순)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const cycles = await prisma.cycle.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { startDate: 'desc' },
    });
    res.json(cycles);
  } catch (error) {
    console.error('Error fetching cycles:', error);
    res.status(500).json({ error: 'Failed to fetch cycles' });
  }
});

// POST /api/cycles — 주기 생성 (OWNER/ADMIN)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const { name, type, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'name, startDate, endDate는 필수입니다.' });
    }
    const cycle = await prisma.cycle.create({
      data: {
        organizationId: req.organizationId!,
        name,
        type: type || 'quarter',
        startDate,
        endDate,
      },
    });
    res.json(cycle);
  } catch (error) {
    console.error('Error creating cycle:', error);
    res.status(500).json({ error: 'Failed to create cycle' });
  }
});

// PUT /api/cycles/:id — 주기 수정 (OWNER/ADMIN, 조직 소유 검증)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const { id } = req.params;
    const { name, type, startDate, endDate } = req.body;
    const result = await prisma.cycle.updateMany({
      where: { id, organizationId: req.organizationId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(startDate !== undefined ? { startDate } : {}),
        ...(endDate !== undefined ? { endDate } : {}),
      },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Cycle not found' });
    const cycle = await prisma.cycle.findUnique({ where: { id } });
    res.json(cycle);
  } catch (error) {
    console.error('Error updating cycle:', error);
    res.status(500).json({ error: 'Failed to update cycle' });
  }
});

// GET /api/cycles/:id/unassigned-overlaps — 기간이 겹치는 미배정 목표 미리보기 (OWNER/ADMIN)
router.get('/:id/unassigned-overlaps', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const found = await findUnassignedOverlaps(req.params.id, req.organizationId!);
    if (!found) return res.status(404).json({ error: 'Cycle not found' });
    res.json({
      count: found.goals.length,
      goals: found.goals.map((g) => ({
        id: g.id,
        title: g.title,
        startDate: g.startDate,
        dueDate: g.dueDate,
        projectName: g.project.name,
      })),
    });
  } catch (error) {
    console.error('Error previewing cycle overlaps:', error);
    res.status(500).json({ error: 'Failed to preview overlapping goals' });
  }
});

// POST /api/cycles/:id/assign-overlaps — 기간이 겹치는 미배정 목표를 이 사이클로 일괄 배정 (OWNER/ADMIN).
// body.goalIds(미리보기에서 사용자가 확인한 목록)가 오면 그 교집합만 배정한다 —
// 미리보기 이후 기간이 바뀌었거나 새로 생긴 목표가 확인 없이 휩쓸려 배정되는 것을 방지.
// 이미 사이클이 지정된 목표는 건드리지 않는다(미배정만 대상).
router.post('/:id/assign-overlaps', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const found = await findUnassignedOverlaps(req.params.id, req.organizationId!);
    if (!found) return res.status(404).json({ error: 'Cycle not found' });

    const requested: unknown = req.body?.goalIds;
    let ids = found.goals.map((g) => g.id);
    if (Array.isArray(requested)) {
      const requestedSet = new Set(requested.filter((v): v is string => typeof v === 'string'));
      ids = ids.filter((id) => requestedSet.has(id));
    }

    let assigned = 0;
    if (ids.length > 0) {
      const result = await prisma.goal.updateMany({
        where: { id: { in: ids }, cycleId: null },
        data: { cycleId: found.cycle.id },
      });
      assigned = result.count;
    }
    res.json({ assigned });
  } catch (error) {
    console.error('Error assigning cycle overlaps:', error);
    res.status(500).json({ error: 'Failed to assign overlapping goals' });
  }
});

// DELETE /api/cycles/:id — 주기 삭제 (OWNER/ADMIN, 조직 소유 검증). 연결 목표는 cycleId=null (SetNull)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const { id } = req.params;
    const result = await prisma.cycle.deleteMany({
      where: { id, organizationId: req.organizationId },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Cycle not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting cycle:', error);
    res.status(500).json({ error: 'Failed to delete cycle' });
  }
});

export default router;
