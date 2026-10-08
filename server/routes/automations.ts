import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateWebhookUrl } from '../lib/webhook';
import { AuthRequest } from '../middleware/auth';
import { requireRole, findProjectInOrg } from '../lib/tenancy';

const router = Router();

const TRIGGER_TYPES = ['goal_created', 'status_changed', 'assignee_changed', 'progress_reached', 'due_date_approaching', 'due_date_arrived'];
const ACTION_TYPES = ['notify_person', 'change_status', 'assign_person', 'set_field', 'create_comment', 'send_webhook'];

// GET /api/automations?projectId= (member)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    if (!(await findProjectInOrg(projectId, req.organizationId!))) return res.status(404).json({ error: 'Project not found' });
    const rules = await prisma.automationRule.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
    res.json(rules);
  } catch (error) {
    console.error('Error fetching automations:', error);
    res.status(500).json({ error: 'Failed to fetch automations' });
  }
});

function validateRuleBody(body: any): string | null {
  if (!body.name) return 'name은 필수입니다.';
  if (!TRIGGER_TYPES.includes(body.triggerType)) return `유효하지 않은 트리거: ${body.triggerType}`;
  const actions = Array.isArray(body.actions) ? body.actions : [];
  if (actions.length === 0) return '액션을 1개 이상 지정하세요.';
  if (actions.length > 5) return '액션은 최대 5개입니다.';
  for (const a of actions) if (!ACTION_TYPES.includes(a.type)) return `유효하지 않은 액션: ${a?.type}`;
  for (const a of actions) {
    if (a.type === 'send_webhook') {
      const problem = validateWebhookUrl(String(a.config?.url ?? ''));
      if (problem) return `웹훅: ${problem}`;
    }
  }
  const conds = Array.isArray(body.condition) ? body.condition : [];
  if (conds.length > 5) return '조건은 최대 5개입니다.';
  return null;
}

// POST /api/automations (OWNER/ADMIN)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const { projectId } = req.body;
    if (!projectId || !(await findProjectInOrg(projectId, req.organizationId!))) return res.status(404).json({ error: 'Project not found' });
    const err = validateRuleBody(req.body);
    if (err) return res.status(400).json({ error: err });
    const rule = await prisma.automationRule.create({
      data: {
        organizationId: req.organizationId!, projectId, createdById: req.user!.userId,
        name: req.body.name, enabled: req.body.enabled !== false,
        triggerType: req.body.triggerType, triggerConfig: req.body.triggerConfig || {},
        condition: req.body.condition ?? null, actions: req.body.actions,
      },
    });
    res.json(rule);
  } catch (error) {
    console.error('Error creating automation:', error);
    res.status(500).json({ error: 'Failed to create automation' });
  }
});

// PUT /api/automations/:id (OWNER/ADMIN)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const rule = await prisma.automationRule.findFirst({ where: { id: req.params.id, organizationId: req.organizationId } });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    const err = validateRuleBody({ ...rule, ...req.body });
    if (err) return res.status(400).json({ error: err });
    const updated = await prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        name: req.body.name ?? rule.name,
        triggerType: req.body.triggerType ?? rule.triggerType,
        triggerConfig: req.body.triggerConfig ?? rule.triggerConfig,
        condition: req.body.condition !== undefined ? req.body.condition : rule.condition,
        actions: req.body.actions ?? rule.actions,
        // 재활성화 시 disabledReason 해제
        ...(req.body.enabled === true ? { enabled: true, disabledReason: null } : {}),
      },
    });
    res.json(updated);
  } catch (error) {
    console.error('Error updating automation:', error);
    res.status(500).json({ error: 'Failed to update automation' });
  }
});

// POST /api/automations/:id/toggle { enabled } (OWNER/ADMIN)
router.post('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const rule = await prisma.automationRule.findFirst({ where: { id: req.params.id, organizationId: req.organizationId } });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    const enabled = !!req.body.enabled;
    const updated = await prisma.automationRule.update({
      where: { id: rule.id }, data: { enabled, ...(enabled ? { disabledReason: null } : {}) },
    });
    res.json(updated);
  } catch (error) {
    console.error('Error toggling automation:', error);
    res.status(500).json({ error: 'Failed to toggle automation' });
  }
});

// DELETE /api/automations/:id (OWNER/ADMIN)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;
    const r = await prisma.automationRule.deleteMany({ where: { id: req.params.id, organizationId: req.organizationId } });
    if (r.count === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting automation:', error);
    res.status(500).json({ error: 'Failed to delete automation' });
  }
});

// GET /api/automations/:id/executions?limit= (member) — 디버그 로그
router.get('/:id/executions', async (req: AuthRequest, res: Response) => {
  try {
    const rule = await prisma.automationRule.findFirst({ where: { id: req.params.id, organizationId: req.organizationId } });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const executions = await prisma.automationExecution.findMany({
      where: { ruleId: rule.id }, orderBy: { createdAt: 'desc' }, take: limit,
    });
    res.json(executions);
  } catch (error) {
    console.error('Error fetching executions:', error);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

export default router;
