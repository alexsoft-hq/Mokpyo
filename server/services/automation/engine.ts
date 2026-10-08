import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { sendWebhook } from '../../lib/webhook';
import { setGoalStatus, syncStatusFromFlags } from '../../lib/statusSync';
import { validateAndMergeFieldValues } from '../../lib/customFieldValues';
import { getOrgMemberIds } from '../../lib/tenancy';
import { AutomationEvent, GoalSnapshot, MAX_DEPTH, TriggerType, EventChanges } from './types';
import { matchesTrigger } from './triggers';
import { passesConditions } from './conditions';

// --- 전역 스위치 ---
function automationsGloballyEnabled(): boolean {
  return process.env.AUTOMATIONS_ENABLED !== 'false';
}

// --- org별 토큰 버킷(인메모리, 분당 60) ---
const buckets = new Map<string, { tokens: number; ts: number }>();
const RATE = 60;
function takeToken(orgId: string, now: number): boolean {
  const b = buckets.get(orgId) ?? { tokens: RATE, ts: now };
  const elapsed = (now - b.ts) / 60000;
  b.tokens = Math.min(RATE, b.tokens + elapsed * RATE);
  b.ts = now;
  if (b.tokens < 1) { buckets.set(orgId, b); return false; }
  b.tokens -= 1;
  buckets.set(orgId, b);
  return true;
}

/**
 * 도메인 이벤트 발행. 뮤테이션 핸들러가 호출 — setImmediate 로 사용자 요청과 분리(fire-and-forget).
 * 절대 throw 하지 않는다(자동화 실패가 사용자 요청을 깨뜨리면 안 됨).
 */
export function emitDomainEvent(input: {
  type: TriggerType;
  organizationId: string;
  projectId: string;
  goalId: string;
  actor?: { userId: string | null; name: string };
  changes?: EventChanges;
  depth?: number;
  visitedRuleIds?: string[];
  eventId?: string; // 스케줄러는 결정적 키 전달(일 1회 dedup)
}): void {
  if (!automationsGloballyEnabled()) return;
  const event: AutomationEvent = {
    type: input.type,
    organizationId: input.organizationId,
    projectId: input.projectId,
    goalId: input.goalId,
    actor: input.actor,
    changes: input.changes ?? {},
    depth: input.depth ?? 0,
    visitedRuleIds: input.visitedRuleIds ?? [],
    eventId: input.eventId ?? randomUUID(),
  };
  setImmediate(() => {
    processEvent(event).catch((e) => console.error('automation processEvent failed:', e));
  });
}

async function loadSnapshot(goalId: string): Promise<GoalSnapshot | null> {
  const g = await prisma.goal.findUnique({
    where: { id: goalId },
    select: {
      id: true, title: true, projectId: true, statusId: true, progress: true,
      completed: true, onHold: true, size: true, customFields: true,
      categories: { select: { id: true } },
    },
  });
  if (!g) return null;
  return {
    id: g.id, title: g.title, projectId: g.projectId, statusId: g.statusId,
    progress: g.progress, completed: g.completed, onHold: g.onHold, size: g.size,
    categoryIds: g.categories.map((c) => c.id),
    customFields: (g.customFields as Record<string, unknown>) || {},
  };
}

async function processEvent(event: AutomationEvent): Promise<void> {
  if (event.depth > MAX_DEPTH) return;

  // org Setting 스위치
  const setting = await prisma.setting.findFirst({
    where: { key: 'automations.enabled', organizationId: event.organizationId },
  });
  if (setting && setting.value === 'false') return;

  const rules = await prisma.automationRule.findMany({
    where: { projectId: event.projectId, triggerType: event.type, enabled: true },
  });
  if (rules.length === 0) return;

  const snapshot = await loadSnapshot(event.goalId);
  if (!snapshot) return;

  for (const rule of rules) {
    if (event.visitedRuleIds.includes(rule.id)) continue; // 루프 가드: 체인 내 재실행 금지
    if (!matchesTrigger(rule as any, event)) continue;

    // 멱등 게이트 먼저: 실행행 선생성(ruleId+eventId unique). 이미 있으면 스킵.
    // (토큰버킷보다 앞 — 중복/재전달 이벤트가 rate-limit 토큰을 소모하지 않도록)
    try {
      await prisma.automationExecution.create({
        data: { ruleId: rule.id, organizationId: event.organizationId, goalId: event.goalId, eventId: event.eventId, status: 'SUCCESS' },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') continue; // 중복 이벤트 — 조용히 스킵(토큰 미소모)
      throw e;
    }

    // 고유 이벤트만 토큰 차감
    if (!takeToken(event.organizationId, Date.now())) {
      await updateExecution(rule.id, event.eventId, 'SKIPPED_RATE_LIMIT', null, 0);
      continue;
    }

    const started = Date.now();
    if (!passesConditions(rule as any, snapshot)) {
      await updateExecution(rule.id, event.eventId, 'CONDITION_NOT_MET', null, Date.now() - started);
      continue;
    }

    try {
      const actionResults = await runActions(rule as any, event, snapshot);
      await updateExecution(rule.id, event.eventId, 'SUCCESS', { actionResults }, Date.now() - started);
      await prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date(), runCount: { increment: 1 } } });
    } catch (err: any) {
      await updateExecution(rule.id, event.eventId, 'FAILED', { error: String(err?.message || err) }, Date.now() - started);
      await maybeCircuitBreak(rule.id);
    }
  }
}

async function recordExecution(ruleId: string, event: AutomationEvent, status: string, detail: any, durationMs: number) {
  try {
    await prisma.automationExecution.create({
      data: { ruleId, organizationId: event.organizationId, goalId: event.goalId, eventId: event.eventId + ':' + status, status, detail, durationMs },
    });
  } catch { /* 멱등 충돌 무시 */ }
}

async function updateExecution(ruleId: string, eventId: string, status: string, detail: any, durationMs: number) {
  await prisma.automationExecution.updateMany({ where: { ruleId, eventId }, data: { status, detail, durationMs } });
}

// 연속 실패 10회 → 서킷브레이커(비활성 + 사유)
async function maybeCircuitBreak(ruleId: string) {
  const recent = await prisma.automationExecution.findMany({
    where: { ruleId }, orderBy: { createdAt: 'desc' }, take: 10, select: { status: true },
  });
  if (recent.length === 10 && recent.every((r) => r.status === 'FAILED')) {
    await prisma.automationRule.update({
      where: { id: ruleId },
      data: { enabled: false, disabledReason: '연속 실패 10회로 자동 비활성화되었습니다.' },
    });
  }
}

// --- 액션 실행 ---
interface ActionResult { type: string; ok: boolean; detail?: string }

async function runActions(rule: any, event: AutomationEvent, snapshot: GoalSnapshot): Promise<ActionResult[]> {
  const actions: { type: string; config: any }[] = Array.isArray(rule.actions) ? rule.actions : [];
  const results: ActionResult[] = [];
  const reEmit = { depth: event.depth + 1, visitedRuleIds: [...event.visitedRuleIds, rule.id] };

  for (const action of actions.slice(0, 5)) {
    try {
      await runOneAction(action, event, snapshot, reEmit);
      results.push({ type: action.type, ok: true });
    } catch (e: any) {
      results.push({ type: action.type, ok: false, detail: String(e?.message || e) });
      throw e; // 첫 실패 시 중단(결정적 시맨틱) — 여기까지 결과는 detail 에 기록됨
    }
  }
  return results;
}

async function runOneAction(
  action: { type: string; config: any },
  event: AutomationEvent,
  snapshot: GoalSnapshot,
  reEmit: { depth: number; visitedRuleIds: string[] }
): Promise<void> {
  const cfg = action.config || {};
  switch (action.type) {
    case 'notify_person': {
      const userIds: string[] = Array.isArray(cfg.userIds) ? cfg.userIds : [];
      const members = await prisma.organizationMember.findMany({
        where: { organizationId: event.organizationId, userId: { in: userIds } }, select: { userId: true },
      });
      if (members.length === 0) return;
      await prisma.notification.createMany({
        data: members.map((m) => ({
          organizationId: event.organizationId, recipientId: m.userId,
          actorName: '자동화', type: 'automation',
          title: '자동화 알림', body: cfg.message || `'${snapshot.title}' 목표에 자동화가 실행되었습니다.`,
          entityType: 'goal', entityId: event.goalId,
        })),
      });
      return;
    }
    case 'change_status': {
      if (!cfg.statusId || snapshot.statusId === cfg.statusId) return;
      const before = snapshot.statusId;
      await setGoalStatus(event.goalId, cfg.statusId, event.organizationId, { bumpVersion: true });
      await writeEngineAudit(event.goalId, snapshot.projectId, `자동화: 상태 변경`);
      // 상태 변경 재발행(depth+1, 체인 dedup)
      emitDomainEvent({
        type: 'status_changed', organizationId: event.organizationId, projectId: event.projectId,
        goalId: event.goalId, actor: { userId: null, name: '자동화' },
        changes: { statusId: { from: before, to: cfg.statusId } }, ...reEmit,
      });
      return;
    }
    case 'assign_person': {
      const userIds: string[] = Array.isArray(cfg.userIds) ? cfg.userIds : [];
      if (userIds.length === 0) return;
      const members = await prisma.organizationMember.findMany({
        where: { organizationId: event.organizationId, userId: { in: userIds } },
        select: { userId: true, user: { select: { name: true } } },
      });
      const existing = await prisma.goalOwner.findMany({ where: { goalId: event.goalId }, select: { userId: true, order: true } });
      const existingIds = new Set(existing.map((o) => o.userId).filter(Boolean));
      let order = existing.length;
      const toAdd = members.filter((m) => !existingIds.has(m.userId));
      for (const m of toAdd) {
        await prisma.goalOwner.create({ data: { goalId: event.goalId, ownerName: m.user?.name || '', userId: m.userId, order: order++ } });
      }
      if (toAdd.length > 0) {
        await writeEngineAudit(event.goalId, snapshot.projectId, `자동화: 담당자 지정`);
        emitDomainEvent({
          type: 'assignee_changed', organizationId: event.organizationId, projectId: event.projectId,
          goalId: event.goalId, actor: { userId: null, name: '자동화' },
          changes: { assigneesAdded: toAdd.map((m) => m.userId) }, ...reEmit,
        });
      }
      return;
    }
    case 'set_field': {
      if (!cfg.fieldId) return;
      const def = await prisma.customFieldDefinition.findFirst({ where: { id: cfg.fieldId, projectId: snapshot.projectId } });
      if (!def) return;
      // 사용자 write 경로와 동일하게 검증(타입·옵션·person 멤버) — 우회 금지. 실패 시 액션 실패로 기록됨.
      const memberIds = await getOrgMemberIds(event.organizationId);
      const merged = validateAndMergeFieldValues(
        [{ id: def.id, type: def.type, config: def.config }],
        snapshot.customFields,
        { [cfg.fieldId]: cfg.value },
        memberIds
      );
      await prisma.goal.update({ where: { id: event.goalId }, data: { customFields: merged as any } });
      await writeEngineAudit(event.goalId, snapshot.projectId, `자동화: 필드 '${def.name}' 설정`);
      return;
    }
    case 'create_comment': {
      await prisma.comment.create({
        data: { goalId: event.goalId, authorId: null, authorName: '자동화', body: cfg.body || '자동화 실행됨' },
      });
      return;
    }
    case 'send_webhook': {
      if (!cfg.url) throw new Error('웹훅 URL 이 비어 있습니다.');
      await sendWebhook({
        url: String(cfg.url),
        secret: cfg.secret ? String(cfg.secret) : undefined,
        event: event.type,
        deliveryId: event.eventId,
        payload: {
          event: event.type,
          deliveryId: event.eventId,
          occurredAt: new Date().toISOString(),
          organizationId: event.organizationId,
          projectId: event.projectId,
          actor: event.actor ?? null,
          changes: event.changes,
          goal: {
            id: snapshot.id, title: snapshot.title, statusId: snapshot.statusId, progress: snapshot.progress,
            completed: snapshot.completed, onHold: snapshot.onHold, size: snapshot.size, categoryIds: snapshot.categoryIds,
          },
        },
      });
      return;
    }
    default:
      return;
  }
}

async function writeEngineAudit(goalId: string, projectId: string, summary: string) {
  try {
    await prisma.auditLog.create({
      data: { action: 'UPDATE', entityType: 'Goal', entityId: goalId, goalId, projectId, summary, userId: null },
    });
  } catch { /* 감사 실패는 무시 */ }
}
