import { prisma } from './prisma';

/**
 * Single source of truth for the Goal.statusId ↔ completed/onHold bridge.
 *
 * DESIGN (adversarial-review critical fix): statusId's label *kind* is authoritative
 * for done/on_hold. completed/onHold are non-deleted MIRROR flags kept only so every
 * legacy view/filter/scanner keeps working untouched. Nothing outside this module may
 * write statusId, completed, or onHold directly.
 *
 * - setGoalStatus:     status → flags   (kanban drag / status cell — the authoritative path)
 * - syncStatusFromFlags: flags → status (the /complete, /hold buttons, boot resync)
 *
 * We NEVER derive completed from progress>=100 here (that old derivation, if kept, would
 * silently demote a user-set Done at progress<100 on the next save/reboot).
 */

// 기본 앵커 라벨 이름 (조직당 시드됨)
export const ANCHOR = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행 중',
  AT_RISK: '위험',
  ON_HOLD: '보류',
  DONE: '완료',
} as const;

export const DEFAULT_STATUS_LABELS = [
  { name: ANCHOR.NOT_STARTED, color: '#94a3b8', kind: 'active', order: 0, isSystem: true },
  { name: ANCHOR.IN_PROGRESS, color: '#3b82f6', kind: 'active', order: 1, isSystem: true },
  { name: ANCHOR.AT_RISK, color: '#ef4444', kind: 'active', order: 2, isSystem: false },
  { name: ANCHOR.ON_HOLD, color: '#f59e0b', kind: 'on_hold', order: 3, isSystem: true },
  { name: ANCHOR.DONE, color: '#22c55e', kind: 'done', order: 4, isSystem: true },
] as const;

// Loosely-typed Prisma client so callers can pass either the singleton or a $transaction client.
type Db = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface FlagState {
  completed?: boolean;
  onHold?: boolean;
  progress?: number;
}

/** kind → completed/onHold flags (the mirror). */
export function flagsForKind(kind: string): { completed: boolean; onHold: boolean } {
  return { completed: kind === 'done', onHold: kind === 'on_hold' };
}

/**
 * 조직에 기본 상태 라벨 5종을 멱등 시드. 이미 있으면 건너뜀(@@unique[orgId,name]).
 * 조직 생성 훅 + GET /api/field-schema lazy 자가치유에서 호출.
 */
export async function ensureDefaultStatusLabels(organizationId: string, db: Db = prisma): Promise<void> {
  const existing = await db.statusLabel.count({ where: { organizationId } });
  if (existing > 0) return;
  await db.statusLabel.createMany({
    data: DEFAULT_STATUS_LABELS.map((l) => ({ ...l, organizationId })),
    skipDuplicates: true,
  });
}

/** 조직의 라벨을 name→label, id→label 로 조회. */
async function loadOrgLabels(organizationId: string, db: Db) {
  const labels = await db.statusLabel.findMany({ where: { organizationId } });
  const byName = new Map(labels.map((l) => [l.name, l]));
  const byId = new Map(labels.map((l) => [l.id, l]));
  return { labels, byName, byId };
}

/**
 * 권위 경로: 상태 라벨을 설정하면 completed/onHold 미러를 그 라벨 kind로 강제.
 * 칸반 드래그·상태 셀 편집에서 사용. version은 옵션(낙관적 잠금 계열 write는 증가).
 * 라벨이 goal의 조직 소속이 아니면 throw.
 */
export async function setGoalStatus(
  goalId: string,
  statusId: string,
  organizationId: string,
  opts: { bumpVersion?: boolean } = {},
  db: Db = prisma
): Promise<{ statusId: string; completed: boolean; onHold: boolean; kind: string }> {
  const label = await db.statusLabel.findFirst({ where: { id: statusId, organizationId } });
  if (!label) {
    throw new Error('STATUS_LABEL_NOT_IN_ORG');
  }
  const flags = flagsForKind(label.kind);
  await db.goal.update({
    where: { id: goalId },
    data: {
      statusId,
      completed: flags.completed,
      onHold: flags.onHold,
      ...(opts.bumpVersion ? { version: { increment: 1 } } : {}),
    },
  });
  return { statusId, ...flags, kind: label.kind };
}

/**
 * 미러 경로: 새 플래그 상태에서 적절한 statusId를 해석해 반영한다.
 * - completed → 완료(done) 앵커
 * - onHold    → 보류(on_hold) 앵커
 * - 둘 다 아님(active): 현 라벨 kind가 이미 active면 보존('위험' 등 유지),
 *                       아니면 progress>0 ? 진행 중 : 시작 전
 * /complete, /hold, PUT(플래그 변경), 부팅 재동기화에서 호출. 변경 없으면 write 생략.
 * 반환: 최종 statusId (없으면 null).
 */
export async function syncStatusFromFlags(
  goalId: string,
  flags: FlagState,
  organizationId: string,
  db: Db = prisma
): Promise<string | null> {
  const goal = await db.goal.findUnique({
    where: { id: goalId },
    select: { statusId: true, progress: true, completed: true, onHold: true },
  });
  if (!goal) return null;

  const completed = flags.completed ?? goal.completed;
  const onHold = flags.onHold ?? goal.onHold;
  const progress = flags.progress ?? goal.progress;

  const { byName, byId } = await loadOrgLabels(organizationId, db);
  const current = goal.statusId ? byId.get(goal.statusId) : undefined;

  let targetName: string;
  if (completed) {
    targetName = ANCHOR.DONE;
  } else if (onHold) {
    targetName = ANCHOR.ON_HOLD;
  } else if (current && current.kind === 'active') {
    // 이미 active 라벨(진행 중/위험/시작 전 등)이면 그대로 보존
    return goal.statusId;
  } else {
    targetName = progress > 0 ? ANCHOR.IN_PROGRESS : ANCHOR.NOT_STARTED;
  }

  const target = byName.get(targetName);
  if (!target) return goal.statusId; // 앵커 라벨이 없으면(비정상) 손대지 않음
  if (goal.statusId === target.id) return goal.statusId; // 변경 없음

  await db.goal.update({ where: { id: goalId }, data: { statusId: target.id } });
  return target.id;
}

/**
 * 목표 생성(POST/copy)용 초기 상태 해석. ...goalData 스프레드로 들어오는 신뢰불가 값 대신
 * 이 함수의 반환값을 create data 에 명시적으로 넣는다.
 * - requestedStatusId 가 조직 소속 라벨이면 그 kind 로 플래그 결정(권위)
 * - 아니면 completed(요청) 우선, 아니면 progress>=100, onHold 요청값 → 앵커 매핑
 * 라벨이 없으면(비정상) 시드 후 재시도.
 */
export async function resolveInitialStatus(
  organizationId: string,
  input: { requestedStatusId?: string | null; completed?: boolean; onHold?: boolean; progress?: number },
  db: Db = prisma
): Promise<{ statusId: string | null; completed: boolean; onHold: boolean }> {
  await ensureDefaultStatusLabels(organizationId, db);
  const { byName, byId } = await loadOrgLabels(organizationId, db);

  if (input.requestedStatusId) {
    const label = byId.get(input.requestedStatusId);
    if (label) {
      return { statusId: label.id, ...flagsForKind(label.kind) };
    }
  }

  const progress = input.progress ?? 0;
  const completed = input.completed ?? progress >= 100;
  const onHold = !completed && (input.onHold ?? false);
  const targetName = completed
    ? ANCHOR.DONE
    : onHold
      ? ANCHOR.ON_HOLD
      : progress > 0
        ? ANCHOR.IN_PROGRESS
        : ANCHOR.NOT_STARTED;
  const target = byName.get(targetName);
  return { statusId: target?.id ?? null, completed, onHold };
}

/**
 * 부팅 재동기화 — 기존 migrateCompletedField()의 대체.
 * ① NULL statusId 백필(신규/복사 누락분) ② 플래그를 statusId.kind에서 재조정(브리지 정합).
 * 절대 progress>=100 으로 completed 를 재계산하지 않는다(사용자 지정 완료 보존).
 */
export async function resyncAllGoalStatuses(): Promise<void> {
  try {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    let fixed = 0;
    for (const org of orgs) {
      await ensureDefaultStatusLabels(org.id);
      const { byName, byId } = await loadOrgLabels(org.id, prisma);
      const goals = await prisma.goal.findMany({
        where: { project: { organizationId: org.id } },
        select: { id: true, statusId: true, completed: true, onHold: true, progress: true },
      });
      for (const g of goals) {
        const current = g.statusId ? byId.get(g.statusId) : undefined;
        if (current) {
          // 플래그를 라벨 kind에 맞춤(라벨이 진실). 불일치 시에만 write.
          const want = flagsForKind(current.kind);
          if (want.completed !== g.completed || want.onHold !== g.onHold) {
            await prisma.goal.update({
              where: { id: g.id },
              data: { completed: want.completed, onHold: want.onHold },
            });
            fixed++;
          }
        } else {
          // statusId 없음 → 플래그/진행률에서 앵커 백필
          const targetName = g.completed
            ? ANCHOR.DONE
            : g.onHold
              ? ANCHOR.ON_HOLD
              : g.progress > 0
                ? ANCHOR.IN_PROGRESS
                : ANCHOR.NOT_STARTED;
          const target = byName.get(targetName);
          if (target) {
            await prisma.goal.update({ where: { id: g.id }, data: { statusId: target.id } });
            fixed++;
          }
        }
      }
    }
    if (fixed > 0) console.log(`✅ Resynced ${fixed} goals' status/flags bridge`);
  } catch (error) {
    console.error('Error resyncing goal statuses:', error);
  }
}
