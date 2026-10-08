import { Response } from 'express';
import { prisma } from './prisma';
import { AuthRequest } from '../middleware/auth';

export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/**
 * 요청자의 조직 내 역할이 allowed에 포함되지 않으면 403을 응답하고 false를 반환한다.
 * resolveOrganization 미들웨어 뒤에서만 유효(req.memberRole 세팅됨).
 * 사용: `if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;`
 */
export function requireRole(req: AuthRequest, res: Response, allowed: MemberRole[]): boolean {
  const role = req.memberRole as MemberRole | undefined;
  if (!role || !allowed.includes(role)) {
    res.status(403).json({ error: '이 작업을 수행할 권한이 없습니다.' });
    return false;
  }
  return true;
}

// --- 테넌트 소유권 검증 헬퍼 ---
// resolveOrganization은 "요청자가 그 조직의 멤버인지"만 보장한다. 아래 헬퍼들은
// "요청한 리소스가 그 조직 소속인지"를 검증한다(둘 다 있어야 테넌트 격리가 성립).
// 소속이면 해당 row를, 아니면(존재하지 않거나 타 조직) null을 반환한다.
// Goal/Category/SubGoal/Note/Attachment는 organizationId 컬럼이 없으므로 Project를 경유해 검증한다.

/** projectId가 organizationId 소속이면 project row, 아니면 null. */
export function findProjectInOrg(projectId: string, organizationId: string) {
  return prisma.project.findFirst({ where: { id: projectId, organizationId } });
}

/** goalId가 (project 경유) organizationId 소속이면 goal row, 아니면 null. */
export function findGoalInOrg(goalId: string, organizationId: string) {
  return prisma.goal.findFirst({ where: { id: goalId, project: { organizationId } } });
}

/** categoryId가 (project 경유) organizationId 소속이면 category row, 아니면 null. */
export function findCategoryInOrg(categoryId: string, organizationId: string) {
  return prisma.category.findFirst({ where: { id: categoryId, project: { organizationId } } });
}

/** attachmentId가 (goal→project 경유) organizationId 소속이면 attachment row, 아니면 null. */
export function findAttachmentInOrg(attachmentId: string, organizationId: string) {
  return prisma.attachment.findFirst({
    where: { id: attachmentId, goal: { project: { organizationId } } },
  });
}

/** reportTemplateId가 organizationId 소속이면 template row, 아니면 null. */
export function findReportTemplateInOrg(templateId: string, organizationId: string) {
  return prisma.reportTemplate.findFirst({ where: { id: templateId, organizationId } });
}

/** cycleId가 organizationId 소속이면 cycle row, 아니면 null. */
export function findCycleInOrg(cycleId: string, organizationId: string) {
  return prisma.cycle.findFirst({ where: { id: cycleId, organizationId } });
}

/** statusLabelId가 organizationId 소속이면 label row, 아니면 null. */
export function findStatusLabelInOrg(statusLabelId: string, organizationId: string) {
  return prisma.statusLabel.findFirst({ where: { id: statusLabelId, organizationId } });
}

/** customFieldDefId가 (project 경유) organizationId 소속이면 def row, 아니면 null. */
export function findFieldDefInOrg(fieldDefId: string, organizationId: string) {
  return prisma.customFieldDefinition.findFirst({
    where: { id: fieldDefId, project: { organizationId } },
  });
}

/** 조직 멤버 userId 집합 (person 커스텀 필드 검증용). */
export async function getOrgMemberIds(organizationId: string): Promise<Set<string>> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  return new Set(members.map((m) => m.userId));
}

/**
 * 조직 멤버의 "이름 → userId" 매핑을 만든다. 목표 담당자(ownerName 문자열)를 실제 User와
 * 연결하는 데 쓴다. 동명이인이 있으면 첫 멤버로 매핑(표시/알림용 best-effort 링크).
 * 매칭 안 되는 이름(게스트·오타·퇴사자)은 맵에 없으므로 userId는 null로 남는다.
 */
export async function buildOwnerNameToUserId(organizationId: string): Promise<Map<string, string>> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    select: { userId: true, user: { select: { name: true } } },
  });
  const map = new Map<string, string>();
  for (const m of members) {
    if (m.user?.name && !map.has(m.user.name)) map.set(m.user.name, m.userId);
  }
  return map;
}
