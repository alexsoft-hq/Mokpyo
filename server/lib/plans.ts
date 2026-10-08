// Self-hosted usage reporting with backward-compatible plan identifiers.
import { prisma } from './prisma';

export type PlanId = 'FREE' | 'PRO' | 'BUSINESS';

export interface PlanLimits {
  members: number | null;         // null = 무제한
  projects: number | null;
  attachmentBytes: number | null; // 워크스페이스 총 첨부 용량
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  pricePerSeatKrw: number; // 월, 인당
  limits: PlanLimits;
  features: {
    automations: boolean;
    savedViews: boolean;
    aiReport: boolean;
    sso: boolean;
    auditExport: boolean;
    prioritySupport: boolean;
  };
}

// Keep legacy IDs for existing databases and API clients; every ID uses the same
// free self-hosted license. Capacity depends on the operator's infrastructure.
function selfHostedPlan(id: PlanId): PlanDefinition {
  return {
    id,
    name: 'Self-hosted',
    pricePerSeatKrw: 0,
    limits: { members: null, projects: null, attachmentBytes: null },
    features: {
      automations: true, savedViews: true, aiReport: true,
      sso: false, auditExport: false, prioritySupport: false,
    },
  };
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: selfHostedPlan('FREE'),
  PRO: selfHostedPlan('PRO'),
  BUSINESS: selfHostedPlan('BUSINESS'),
};

export interface OrgUsage {
  members: number;
  pendingInvitations: number;
  projects: number;
  goals: number;
  attachmentBytes: number;
}

export function isPlanEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PLAN_ENFORCEMENT === 'true';
}

export function getPlan(plan: string | null | undefined): PlanDefinition {
  return PLANS[(plan as PlanId) in PLANS ? (plan as PlanId) : 'FREE'];
}

export async function getOrgUsage(organizationId: string): Promise<OrgUsage> {
  const [members, pendingInvitations, projects, goals, attachmentAgg] = await Promise.all([
    prisma.organizationMember.count({ where: { organizationId } }),
    prisma.invitation.count({ where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.project.count({ where: { organizationId } }),
    prisma.goal.count({ where: { project: { organizationId } } }),
    prisma.attachment.aggregate({ _sum: { size: true }, where: { goal: { project: { organizationId } } } }),
  ]);
  return {
    members,
    pendingInvitations,
    projects,
    goals,
    attachmentBytes: Number(attachmentAgg._sum.size || 0),
  };
}

export interface LimitCheck {
  ok: boolean;
  limit: number | null;
  current: number;
  message?: string;
}

/**
 * kind 별 한도 검사. current 는 "이미 있는 것 + 지금 추가하려는 것"이 아니라 현재 수 — 추가 가능 여부는 current < limit.
 * members 는 대기 중 초대도 좌석으로 센다(초대 수락 시 초과를 막기 위해).
 */
export function checkLimit(kind: 'members' | 'projects', plan: PlanDefinition, usage: OrgUsage, enforced = isPlanEnforced()): LimitCheck {
  const limit = plan.limits[kind];
  const current = kind === 'members' ? usage.members + usage.pendingInvitations : usage.projects;
  if (!enforced || limit === null || current < limit) return { ok: true, limit, current };
  const label = kind === 'members' ? '멤버(대기 중 초대 포함)' : '프로젝트';
  return {
    ok: false,
    limit,
    current,
    message: `${plan.name} 플랜의 ${label} 한도(${limit})에 도달했습니다. 서버 운영자에게 문의하세요.`,
  };
}

/** 조직의 플랜·사용량·한도를 한 번에. 설정 화면과 한도 검사가 공유한다. */
export async function getOrgPlanSummary(organizationId: string, planId: string | null | undefined) {
  const plan = getPlan(planId);
  const usage = await getOrgUsage(organizationId);
  return {
    plan: plan.id,
    planName: plan.name,
    pricePerSeatKrw: plan.pricePerSeatKrw,
    limits: plan.limits,
    features: plan.features,
    usage,
    enforced: isPlanEnforced(),
  };
}
