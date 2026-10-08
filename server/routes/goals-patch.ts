import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { findGoalInOrg, findCycleInOrg, buildOwnerNameToUserId } from '../lib/tenancy';
import { resolveInitialStatus, syncStatusFromFlags } from '../lib/statusSync';
import { emitDomainEvent } from '../services/automation/engine';
import { createAssignmentNotifications } from '../lib/notifications';

const router = Router();

// 테이블 인라인 편집용 부분 업데이트. 전체 PUT(GoalDetailModal 전용)의 409 폭풍을 피하기 위한 경로.
// 화이트리스트만 허용 — parentGoalId(순환검증 필요)·projectId·categories 는 여기서 제외(전용 경로 사용).
const SCALAR_FIELDS = ['title', 'owner', 'progress', 'size', 'startDate', 'dueDate', 'statusNote', 'cycleId'] as const;

// GET 단건과 동일한 형태로 직렬화 (owners 포함 — /complete·/hold 가 빠뜨렸던 부분).
async function serializeGoal(id: string) {
  const goal = await prisma.goal.findUnique({
    where: { id },
    include: {
      categories: true,
      goalOwners: { orderBy: { order: 'asc' } },
      subGoals: {
        orderBy: { order: 'asc' },
        include: { subGoalOwners: { orderBy: { order: 'asc' } } },
      },
      notes: { orderBy: { createdAt: 'desc' } },
      attachments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!goal) return null;
  return {
    ...goal,
    owner: goal.goalOwners.length > 0 ? goal.goalOwners[0].ownerName : goal.owner,
    owners: goal.goalOwners.length > 0 ? goal.goalOwners.map((o) => o.ownerName) : goal.owner ? [goal.owner] : [],
    categories: goal.categories.map((c) => c.name),
    subGoals: goal.subGoals.map((sg) => ({
      ...sg,
      owner: sg.subGoalOwners.length > 0 ? sg.subGoalOwners[0].ownerName : sg.owner,
      owners: sg.subGoalOwners.length > 0 ? sg.subGoalOwners.map((o) => o.ownerName) : sg.owner ? [sg.owner] : [],
    })),
  };
}

// PATCH /api/goals/:id — 부분 업데이트 (모든 멤버)
router.patch('/goals/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { version } = req.body;

    const current = await findGoalInOrg(id, req.organizationId!);
    if (!current) return res.status(404).json({ error: 'Goal not found' });

    // 낙관적 잠금 — 불일치 시 최신 데이터 동봉해 409
    if (version !== undefined && current.version !== version) {
      const currentData = await serializeGoal(id);
      return res.status(409).json({ error: 'Conflict', currentData });
    }

    const data: any = {};
    for (const f of SCALAR_FIELDS) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    // owners 배열이 오면 첫 담당자를 owner 스칼라에 동기화(PUT 과 동일)
    const ownersInput: string[] | undefined = Array.isArray(req.body.owners) ? req.body.owners : undefined;
    if (ownersInput) data.owner = ownersInput[0] ?? '';

    // cycleId 조직 소속 검증(설정 시)
    if (data.cycleId !== undefined && data.cycleId !== null) {
      if (!(await findCycleInOrg(data.cycleId, req.organizationId!))) {
        return res.status(400).json({ error: 'Cycle not found' });
      }
    }

    const beforeStatusId = current.statusId;

    // 진행률 100 상향 도달 → 완료 자동 승격(권위: 완료 라벨+미러). progress<100 은 강등 안 함.
    const newProgress = data.progress !== undefined ? data.progress : current.progress;
    let syncFlags: { completed?: boolean; onHold?: boolean } | null = null;
    let promotedStatusId: string | null = null;
    if (newProgress >= 100 && !current.completed) {
      const promoted = await resolveInitialStatus(req.organizationId!, { completed: true });
      data.completed = true;
      data.onHold = false;
      data.statusId = promoted.statusId;
      promotedStatusId = promoted.statusId;
    } else if (typeof req.body.completed === 'boolean' || typeof req.body.onHold === 'boolean') {
      // 명시적 완료/보류 토글(레거시 체크박스 형태) — 상호 배타 후 statusSync 로 라벨 정합
      const completed = req.body.completed ?? current.completed;
      const onHold = completed ? false : (req.body.onHold ?? current.onHold);
      data.completed = completed;
      data.onHold = onHold;
      syncFlags = { completed, onHold };
    }

    await prisma.goal.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });

    // 담당자(goalOwners) 관계 교체 — 테이블 Person 셀 편집 반영(스칼라 owner 만으론 손실됨)
    let newlyAssigned: string[] = [];
    if (ownersInput) {
      const ownerMap = await buildOwnerNameToUserId(req.organizationId!);
      const oldOwners = await prisma.goalOwner.findMany({ where: { goalId: id }, select: { userId: true } });
      const oldIds = new Set(oldOwners.map((o) => o.userId).filter(Boolean));
      await prisma.goalOwner.deleteMany({ where: { goalId: id } });
      if (ownersInput.length > 0) {
        await prisma.goalOwner.createMany({
          data: ownersInput.map((name, idx) => ({ goalId: id, ownerName: name, userId: ownerMap.get(name) ?? null, order: idx })),
        });
      }
      newlyAssigned = ownersInput.map((n) => ownerMap.get(n)).filter((u): u is string => !!u && !oldIds.has(u));
    }

    if (syncFlags) {
      await syncStatusFromFlags(id, syncFlags, req.organizationId!);
    }

    await (req as any).audit?.({
      action: 'UPDATE',
      entityType: 'Goal',
      entityId: id,
      entityTitle: current.title,
      goalId: id,
      projectId: current.projectId,
      summary: `목표 '${current.title}' 수정`,
      changes: data,
    });

    const actor = { userId: req.user!.userId, name: req.user!.name };

    // 새 담당자 배정 알림 + 자동화(assignee_changed)
    if (newlyAssigned.length > 0) {
      await createAssignmentNotifications({
        organizationId: req.organizationId!, goalId: id, goalTitle: current.title,
        assigneeUserIds: newlyAssigned, actorUserId: req.user!.userId, actorName: req.user!.name,
      });
      emitDomainEvent({
        type: 'assignee_changed', organizationId: req.organizationId!, projectId: current.projectId,
        goalId: id, actor, changes: { assigneesAdded: newlyAssigned },
      });
    }

    // 자동화 이벤트: 진행률 상향 도달(인라인 편집)
    if (req.body.progress !== undefined && req.body.progress !== current.progress) {
      emitDomainEvent({
        type: 'progress_reached', organizationId: req.organizationId!, projectId: current.projectId,
        goalId: id, actor, changes: { progress: { from: current.progress, to: req.body.progress } },
      });
    }
    // 자동화 이벤트: 자동 완료 승격으로 상태가 바뀌면 status_changed 도 발행(상태 트리거 누락 방지)
    if (promotedStatusId && promotedStatusId !== beforeStatusId) {
      emitDomainEvent({
        type: 'status_changed', organizationId: req.organizationId!, projectId: current.projectId,
        goalId: id, actor, changes: { statusId: { from: beforeStatusId, to: promotedStatusId } },
      });
    }

    const serialized = await serializeGoal(id);
    res.json(serialized);
  } catch (error) {
    console.error('Error patching goal:', error);
    res.status(500).json({ error: 'Failed to patch goal' });
  }
});

export default router;
