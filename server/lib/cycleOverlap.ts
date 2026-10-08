// 사이클-목표 기간 겹침 판정. 날짜는 'YYYY-MM-DD'(또는 ISO 문자열) — 앞 10자 사전순 비교.

export interface GoalDateRange {
  startDate?: string | null;
  dueDate?: string | null;
}

export interface CycleDateRange {
  startDate: string;
  endDate: string;
}

const day = (value?: string | null): string => (value ? value.slice(0, 10) : '');

/**
 * 목표의 유효 기간 [start, end]. 한쪽만 있으면 그 날짜 하루로 간주,
 * 둘 다 없으면 null(기간 판정 불가 → 일괄 배정 대상에서 제외).
 */
export function effectiveRange(goal: GoalDateRange): { start: string; end: string } | null {
  const s = day(goal.startDate);
  const d = day(goal.dueDate);
  const start = s || d;
  const end = d || s;
  if (!start) return null;
  return { start, end };
}

/** 목표 기간이 사이클 기간과 겹치는가 (경계일 포함) */
export function goalOverlapsCycle(goal: GoalDateRange, cycle: CycleDateRange): boolean {
  const range = effectiveRange(goal);
  if (!range) return false;
  return range.start <= day(cycle.endDate) && range.end >= day(cycle.startDate);
}
