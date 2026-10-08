import { Goal } from '@/types/goal';
import { StatusLabel } from '@/types/fields';

export interface Bucket { key: string; label: string; count: number; color?: string; }

/** 요약 지표. */
export function summarize(goals: Goal[]) {
  const total = goals.length;
  const completed = goals.filter((g) => g.completed).length;
  const onHold = goals.filter((g) => g.onHold).length;
  const avgProgress = total > 0 ? Math.round(goals.reduce((s, g) => s + (g.progress ?? 0), 0) / total) : 0;
  return { total, completed, onHold, avgProgress };
}

/** 상태 라벨별 집계(라벨 order·색상). statusId 없는 목표는 '상태 없음'. */
export function byStatus(goals: Goal[], labels: StatusLabel[]): Bucket[] {
  const byId = new Map(labels.map((l) => [l.id, l]));
  const counts = new Map<string, number>();
  for (const g of goals) {
    const key = g.statusId && byId.has(g.statusId) ? g.statusId : '__none__';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ordered = [...labels].sort((a, b) => a.order - b.order);
  const result: Bucket[] = ordered
    .filter((l) => counts.has(l.id))
    .map((l) => ({ key: l.id, label: l.name, count: counts.get(l.id)!, color: l.color }));
  if (counts.has('__none__')) result.push({ key: '__none__', label: '상태 없음', count: counts.get('__none__')!, color: '#9ca3af' });
  return result;
}

/** 담당자별(첫 담당자) 집계 — 상위 N. */
export function byOwner(goals: Goal[], topN = 10): Bucket[] {
  const counts = new Map<string, number>();
  for (const g of goals) {
    const owner = g.owners?.[0] ?? g.owner ?? '미지정';
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/** 카테고리별(첫 카테고리) 집계. */
export function byCategory(goals: Goal[]): Bucket[] {
  const counts = new Map<string, number>();
  for (const g of goals) {
    const cat = g.categories?.[0] ?? '미분류';
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ key: label, label, count })).sort((a, b) => b.count - a.count);
}

/** YYYY-MM-DD 에 일수를 더한 날짜 문자열(UTC 파싱·포맷 일관 — 타임존 off-by-one 방지). */
export function addDaysStr(dateStr: string, days: number): string {
  return new Date(new Date(dateStr + 'T00:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10);
}

/** 마감 임박(미완료·비보류, dueDate ≤ today+days, 오름차순). todayStr 은 로컬 기준 YYYY-MM-DD. */
export function upcomingDeadlines(goals: Goal[], todayStr: string, days = 14): Goal[] {
  const hi = addDaysStr(todayStr, days);
  return goals
    .filter((g) => !g.completed && !g.onHold && g.dueDate && g.dueDate >= todayStr && g.dueDate <= hi)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
}
