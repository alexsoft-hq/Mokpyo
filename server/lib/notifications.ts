import { prisma } from './prisma';

/**
 * 목표 담당자 배정 알림을 생성한다. 새로 배정된 조직 멤버(userId)들에게만,
 * 배정을 수행한 본인(actor)은 제외하고 알림을 남긴다.
 * assigneeUserIds에는 null/중복이 섞여 있어도 안전하게 정리한다.
 */
export async function createAssignmentNotifications(params: {
  organizationId: string;
  goalId: string;
  goalTitle: string;
  assigneeUserIds: (string | null | undefined)[];
  actorUserId: string;
  actorName: string;
}): Promise<number> {
  const recipients = [
    ...new Set(
      params.assigneeUserIds.filter((uid): uid is string => !!uid && uid !== params.actorUserId)
    ),
  ];
  if (recipients.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: recipients.map((recipientId) => ({
      organizationId: params.organizationId,
      recipientId,
      actorId: params.actorUserId,
      actorName: params.actorName,
      type: 'GOAL_ASSIGNED',
      title: `목표 담당자로 지정되었습니다`,
      body: `${params.actorName}님이 회원님을 '${params.goalTitle}' 목표의 담당자로 지정했습니다.`,
      entityType: 'Goal',
      entityId: params.goalId,
    })),
  });
  return result.count;
}

/**
 * 댓글 @멘션 알림을 생성한다. 멘션된 조직 멤버(userId)들에게, 작성자(actor) 제외.
 * userId 가 실제 조직 멤버인지 검증한 대상에게만 알림을 남긴다.
 */
export async function createMentionNotifications(params: {
  organizationId: string;
  goalId: string;
  goalTitle: string;
  mentionedUserIds: string[];
  actorUserId: string;
  actorName: string;
}): Promise<number> {
  const candidates = [...new Set(params.mentionedUserIds.filter((u) => u && u !== params.actorUserId))];
  if (candidates.length === 0) return 0;
  // 조직 멤버만 남김(타 조직·유령 id 차단)
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: params.organizationId, userId: { in: candidates } },
    select: { userId: true },
  });
  const recipients = members.map((m) => m.userId);
  if (recipients.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: recipients.map((recipientId) => ({
      organizationId: params.organizationId,
      recipientId,
      actorId: params.actorUserId,
      actorName: params.actorName,
      type: 'mention',
      title: '댓글에서 회원님을 멘션했습니다',
      body: `${params.actorName}님이 '${params.goalTitle}' 목표의 댓글에서 회원님을 언급했습니다.`,
      entityType: 'goal',
      entityId: params.goalId,
    })),
  });
  return result.count;
}

/**
 * 마감(dueDate)이 withinDays 이내로 임박한 미완료·비보류 목표를 스캔해 담당자에게
 * GOAL_DUE_SOON 알림을 남긴다. 같은 목표+수신자에 대해 최근 24h 내 동일 알림이 있으면
 * 건너뛴다(중복 방지). dueDate는 'YYYY-MM-DD' 문자열이라 사전식 비교로 범위를 거른다.
 * 인프로세스 스케줄러가 주기 호출한다.
 */
export async function scanAndNotifyDueSoon(withinDays = 3): Promise<number> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const soonStr = new Date(now.getTime() + withinDays * 86400000).toISOString().slice(0, 10);
  const dedupCutoff = new Date(now.getTime() - 24 * 3600 * 1000);

  const goals = await prisma.goal.findMany({
    where: {
      completed: false,
      onHold: false,
      dueDate: { gte: todayStr, lte: soonStr },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      project: { select: { organizationId: true } },
      goalOwners: { select: { userId: true } },
    },
  });

  let created = 0;
  for (const g of goals) {
    const organizationId = g.project.organizationId;
    const recipients = [
      ...new Set(g.goalOwners.map((o) => o.userId).filter((u): u is string => !!u)),
    ];
    for (const recipientId of recipients) {
      const exists = await prisma.notification.findFirst({
        where: {
          recipientId,
          type: 'GOAL_DUE_SOON',
          entityId: g.id,
          createdAt: { gte: dedupCutoff },
        },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.notification.create({
        data: {
          organizationId,
          recipientId,
          type: 'GOAL_DUE_SOON',
          title: '목표 마감이 다가옵니다',
          body: `'${g.title}' 목표의 마감일(${g.dueDate})이 임박했습니다.`,
          entityType: 'Goal',
          entityId: g.id,
        },
      });
      created++;
    }
  }
  return created;
}

/**
 * 마감임박 스캐너를 인프로세스 스케줄러로 기동한다(시작 30초 후 1회 + 이후 주기).
 * 서버 부팅 시 index.ts/production.ts에서 호출한다.
 */
export function startDueSoonScheduler(intervalMs = 6 * 60 * 60 * 1000): void {
  const run = () =>
    scanAndNotifyDueSoon().catch((e) => console.error('due-soon scan failed:', e));
  setTimeout(run, 30000);
  setInterval(run, intervalMs);
}
