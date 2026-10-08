import { getLocale, t } from '@/i18n';
import { Goal } from '@/types/goal';
import { StatusLabel } from '@/types/fields';

export type GroupByKey = 'none' | 'status' | 'category' | 'owner' | 'cycle';

export interface GoalGroup {
  key: string;          // 안정 키(라벨 id / 카테고리명 / 담당자명 / 사이클 id / '__none__')
  label: string;        // 표시 이름
  color?: string;       // 상태/사이클 색(선택)
  goals: Goal[];
  count: number;
  avgProgress: number;  // 반올림 평균 진행률
  doneCount: number;    // 완료 개수
}

const NONE_KEY = '__none__';

export interface GroupContext {
  statusById: Map<string, StatusLabel>;
  cycleById: Map<string, { id: string; name: string }>;
}

/**
 * 목표 배열을 groupBy 기준으로 버킷팅. 다중 소속(카테고리·담당자)은 '첫 값' 기준 —
 * 행 중복 출현 금지(툴팁으로 명시). 그룹 순서: status=라벨 order, cycle=이름, category/owner=가나다,
 * 미분류('상태 없음' 등)는 항상 말미. 순수 함수 → 단위 테스트 대상.
 */
export function groupGoals(goals: Goal[], groupBy: GroupByKey, ctx: GroupContext): GoalGroup[] {
  if (groupBy === 'none') {
    return [buildGroup(NONE_KEY, t("전체"), goals, undefined, 0)];
  }

  const buckets = new Map<string, Goal[]>();
  const order = new Map<string, number>(); // 정렬 가중치
  const labelOf = new Map<string, string>();
  const colorOf = new Map<string, string>();

  const pushTo = (key: string, label: string, g: Goal, sortWeight: number, color?: string) => {
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.set(key, sortWeight);
      labelOf.set(key, label);
      if (color) colorOf.set(key, color);
    }
    buckets.get(key)!.push(g);
  };

  for (const g of goals) {
    if (groupBy === 'status') {
      const label = g.statusId ? ctx.statusById.get(g.statusId) : undefined;
      if (label) pushTo(label.id, label.name, g, label.order, label.color);
      else pushTo(NONE_KEY, t("상태 없음"), g, Number.MAX_SAFE_INTEGER);
    } else if (groupBy === 'category') {
      const cat = g.categories?.[0];
      if (cat) pushTo(cat, cat, g, 0);
      else pushTo(NONE_KEY, t("분류 없음"), g, Number.MAX_SAFE_INTEGER);
    } else if (groupBy === 'owner') {
      const owner = g.owners?.[0] ?? g.owner;
      if (owner) pushTo(owner, owner, g, 0);
      else pushTo(NONE_KEY, t("담당자 없음"), g, Number.MAX_SAFE_INTEGER);
    } else if (groupBy === 'cycle') {
      const cyc = g.cycleId ? ctx.cycleById.get(g.cycleId) : undefined;
      if (cyc) pushTo(cyc.id, cyc.name, g, 0);
      else pushTo(NONE_KEY, t("사이클 없음"), g, Number.MAX_SAFE_INTEGER);
    }
  }

  const groups = Array.from(buckets.entries()).map(([key, gs]) =>
    buildGroup(key, labelOf.get(key)!, gs, colorOf.get(key), order.get(key) ?? 0)
  );

  // 정렬: status/cycle 은 order/이름 가중치, 그 외 가나다. 미분류는 항상 끝.
  groups.sort((a, b) => {
    const aNone = a.key === NONE_KEY ? 1 : 0;
    const bNone = b.key === NONE_KEY ? 1 : 0;
    if (aNone !== bNone) return aNone - bNone;
    if (groupBy === 'status') return (a.sortWeight ?? 0) - (b.sortWeight ?? 0);
    return a.label.localeCompare(b.label, getLocale());
  });

  return groups;
}

interface InternalGroup extends GoalGroup {
  sortWeight?: number;
}

function buildGroup(key: string, label: string, goals: Goal[], color: string | undefined, sortWeight: number): InternalGroup {
  const count = goals.length;
  const sum = goals.reduce((acc, g) => acc + (g.progress ?? 0), 0);
  const doneCount = goals.filter((g) => g.completed).length;
  return {
    key,
    label,
    color,
    goals,
    count,
    avgProgress: count > 0 ? Math.round(sum / count) : 0,
    doneCount,
    sortWeight,
  };
}
