import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  requireRole,
  findGoalInOrg,
  findProjectInOrg,
  findStatusLabelInOrg,
  findFieldDefInOrg,
  getOrgMemberIds,
} from '../lib/tenancy';
import {
  ensureDefaultStatusLabels,
  setGoalStatus,
  ANCHOR,
} from '../lib/statusSync';
import { validateAndMergeFieldValues, FieldDef } from '../lib/customFieldValues';
import { emitDomainEvent } from '../services/automation/engine';

const router = Router();

const FIELD_TYPES = ['text', 'number', 'date', 'person', 'dropdown', 'priority'];

// priority 커스텀 필드 기본 옵션 — src/lib/priorityColors.ts 팔레트·라벨 정합(5단계)
const PRIORITY_PRESET = [
  { id: 'p_xl', label: '최고', color: '#ef4444' },
  { id: 'p_large', label: '높음', color: '#f97316' },
  { id: 'p_medium', label: '중간', color: '#eab308' },
  { id: 'p_small', label: '낮음', color: '#3b82f6' },
  { id: 'p_xs', label: '최저', color: '#9ca3af' },
];

// GET /api/field-schema?projectId= — 상태 라벨(org) + 커스텀 필드 정의(project). 프론트가 캐시해 목표와 조인.
router.get('/field-schema', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    // 조직에 기본 상태 라벨이 없으면 lazy 시드(자가치유)
    await ensureDefaultStatusLabels(req.organizationId!);
    const statusLabels = await prisma.statusLabel.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { order: 'asc' },
    });
    let customFields: any[] = [];
    if (projectId) {
      if (!(await findProjectInOrg(projectId, req.organizationId!))) {
        return res.status(404).json({ error: 'Project not found' });
      }
      customFields = await prisma.customFieldDefinition.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
      });
    }
    res.json({ statusLabels, customFields });
  } catch (error) {
    console.error('Error fetching field schema:', error);
    res.status(500).json({ error: 'Failed to fetch field schema' });
  }
});

// ---- Status labels (org-scoped, OWNER/ADMIN for writes) ----

// POST /api/status-labels { name, color } — 사용자 생성 라벨은 v1에서 kind='active' 강제
router.post('/status-labels', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const { name, color } = req.body;
    if (!name || !color) return res.status(400).json({ error: 'name, color는 필수입니다.' });
    const count = await prisma.statusLabel.count({ where: { organizationId: req.organizationId } });
    const label = await prisma.statusLabel.create({
      data: {
        organizationId: req.organizationId!,
        name,
        color,
        kind: 'active', // done/on_hold 앵커 유일성 유지 — 사용자 라벨은 active만
        isSystem: false,
        order: count,
      },
    });
    res.json(label);
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: '같은 이름의 상태가 이미 있습니다.' });
    console.error('Error creating status label:', error);
    res.status(500).json({ error: 'Failed to create status label' });
  }
});

// PUT /api/status-labels/:id { name?, color?, order? } — 시스템 라벨은 name/kind 변경 금지(앵커 이름 기반 조회 보호)
router.put('/status-labels/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const label = await findStatusLabelInOrg(req.params.id, req.organizationId!);
    if (!label) return res.status(404).json({ error: 'Status label not found' });
    const { name, color, order } = req.body;
    const data: any = {};
    if (color !== undefined) data.color = color;
    if (order !== undefined) data.order = order;
    if (name !== undefined && name !== label.name) {
      if (label.isSystem) return res.status(400).json({ error: '시스템 상태 라벨의 이름은 변경할 수 없습니다.' });
      data.name = name;
    }
    const updated = await prisma.statusLabel.update({ where: { id: label.id }, data });
    res.json(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: '같은 이름의 상태가 이미 있습니다.' });
    console.error('Error updating status label:', error);
    res.status(500).json({ error: 'Failed to update status label' });
  }
});

// DELETE /api/status-labels/:id — 시스템 라벨 삭제 금지. 삭제 전 해당 목표를 '시작 전'으로 재배정(NULL orphan 방지)
router.delete('/status-labels/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const label = await findStatusLabelInOrg(req.params.id, req.organizationId!);
    if (!label) return res.status(404).json({ error: 'Status label not found' });
    if (label.isSystem) return res.status(400).json({ error: '기본 상태 라벨은 삭제할 수 없습니다.' });

    // 삭제 대상 라벨을 쓰던 목표를 조직 기본 앵커 '시작 전'(active)으로 재배정.
    // 삭제 가능한 라벨은 전부 active kind 이므로 completed/onHold=false 로 안전.
    const notStarted = await prisma.statusLabel.findFirst({
      where: { organizationId: req.organizationId, name: ANCHOR.NOT_STARTED },
    });
    if (notStarted) {
      await prisma.goal.updateMany({
        where: { statusId: label.id },
        data: { statusId: notStarted.id, completed: false, onHold: false },
      });
    }
    await prisma.statusLabel.delete({ where: { id: label.id } });
    res.json({ success: true, reassignedTo: notStarted?.id ?? null });
  } catch (error) {
    console.error('Error deleting status label:', error);
    res.status(500).json({ error: 'Failed to delete status label' });
  }
});

// ---- Custom field definitions (per-project, OWNER/ADMIN for writes) ----

// POST /api/projects/:projectId/fields { name, type, config? }
router.post('/projects/:projectId/fields', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const { projectId } = req.params;
    if (!(await findProjectInOrg(projectId, req.organizationId!))) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { name, type } = req.body;
    let { config } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name, type는 필수입니다.' });
    if (!FIELD_TYPES.includes(type)) return res.status(400).json({ error: `유효하지 않은 필드 타입: ${type}` });

    config = config && typeof config === 'object' ? config : {};
    // priority 는 옵션 미지정 시 프리셋 시드
    if (type === 'priority' && !Array.isArray(config.options)) {
      config = { ...config, options: PRIORITY_PRESET };
    }

    const count = await prisma.customFieldDefinition.count({ where: { projectId } });
    const def = await prisma.customFieldDefinition.create({
      data: { projectId, name, type, config, order: count },
    });
    res.json(def);
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: '같은 이름의 필드가 이미 있습니다.' });
    console.error('Error creating custom field:', error);
    res.status(500).json({ error: 'Failed to create custom field' });
  }
});

// PUT /api/fields/:id { name?, config?, order? }
router.put('/fields/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const def = await findFieldDefInOrg(req.params.id, req.organizationId!);
    if (!def) return res.status(404).json({ error: 'Field not found' });
    const { name, config, order } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (order !== undefined) data.order = order;
    if (config !== undefined && typeof config === 'object') data.config = config;
    const updated = await prisma.customFieldDefinition.update({ where: { id: def.id }, data });
    res.json(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: '같은 이름의 필드가 이미 있습니다.' });
    console.error('Error updating custom field:', error);
    res.status(500).json({ error: 'Failed to update custom field' });
  }
});

// DELETE /api/fields/:id — 값(Goal.customFields[defId])은 조회 시 무시되므로 별도 정리 불필요
router.delete('/fields/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const def = await findFieldDefInOrg(req.params.id, req.organizationId!);
    if (!def) return res.status(404).json({ error: 'Field not found' });
    await prisma.customFieldDefinition.delete({ where: { id: def.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom field:', error);
    res.status(500).json({ error: 'Failed to delete custom field' });
  }
});

// ---- Goal status / custom-field value writes (all members) ----

// PUT /api/goals/:id/status { statusId, version? } — 칸반 드래그·상태 셀. 권위 경로(라벨→플래그). version 낙관적 잠금.
router.put('/goals/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { statusId, version } = req.body;
    if (!statusId) return res.status(400).json({ error: 'statusId는 필수입니다.' });

    const current = await findGoalInOrg(id, req.organizationId!);
    if (!current) return res.status(404).json({ error: 'Goal not found' });
    if (version !== undefined && current.version !== version) {
      return res.status(409).json({ error: 'Conflict', currentData: current });
    }
    if (!(await findStatusLabelInOrg(statusId, req.organizationId!))) {
      return res.status(400).json({ error: 'Status label not found' });
    }

    const result = await setGoalStatus(id, statusId, req.organizationId!, { bumpVersion: true });

    await (req as any).audit?.({
      action: 'UPDATE',
      entityType: 'Goal',
      entityId: id,
      entityTitle: current.title,
      goalId: id,
      projectId: current.projectId,
      summary: `목표 '${current.title}' 상태 변경`,
      changes: { statusId: { from: current.statusId, to: statusId } },
    });

    // 자동화 이벤트: 상태 변경(칸반 드래그·상태 셀)
    if (current.statusId !== statusId) {
      emitDomainEvent({
        type: 'status_changed', organizationId: req.organizationId!, projectId: current.projectId,
        goalId: id, actor: { userId: req.user!.userId, name: req.user!.name },
        changes: { statusId: { from: current.statusId, to: statusId } },
      });
    }

    const goal = await prisma.goal.findUnique({ where: { id } });
    res.json({ ...goal, statusResult: result });
  } catch (error: any) {
    if (error?.message === 'STATUS_LABEL_NOT_IN_ORG') {
      return res.status(400).json({ error: 'Status label not found' });
    }
    console.error('Error setting goal status:', error);
    res.status(500).json({ error: 'Failed to set goal status' });
  }
});

// PUT /api/goals/:id/field { fieldId, value } — 커스텀 필드 인라인 편집. versionless upsert(goal.version 미증가).
router.put('/goals/:id/field', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fieldId, value } = req.body;
    if (!fieldId) return res.status(400).json({ error: 'fieldId는 필수입니다.' });

    const goal = await findGoalInOrg(id, req.organizationId!);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const def = await prisma.customFieldDefinition.findFirst({
      where: { id: fieldId, projectId: goal.projectId },
    });
    if (!def) return res.status(400).json({ error: '이 프로젝트의 필드가 아닙니다.' });

    const memberIds = await getOrgMemberIds(req.organizationId!);
    const current = (goal.customFields as Record<string, unknown>) || {};
    let merged: Record<string, unknown>;
    try {
      merged = validateAndMergeFieldValues(
        [{ id: def.id, type: def.type, config: def.config } as FieldDef],
        current,
        { [fieldId]: value },
        memberIds
      );
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || '필드 값이 유효하지 않습니다.' });
    }

    await prisma.goal.update({ where: { id }, data: { customFields: merged as any } });

    await (req as any).audit?.({
      action: 'UPDATE',
      entityType: 'Goal',
      entityId: id,
      entityTitle: goal.title,
      goalId: id,
      projectId: goal.projectId,
      summary: `목표 '${goal.title}' 필드 '${def.name}' 수정`,
      changes: { [def.name]: value },
    });

    res.json({ id, customFields: merged });
  } catch (error) {
    console.error('Error setting goal field value:', error);
    res.status(500).json({ error: 'Failed to set goal field value' });
  }
});

export default router;
