import { Cycle } from '@/lib/api';

const day = (value?: string | null): string => (value ? value.slice(0, 10) : '');

/** 로컬 타임존 기준 오늘 날짜(YYYY-MM-DD). toISOString은 UTC라 KST 밤에 하루 밀리므로 사용 금지. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 오늘이 기간에 포함되는 사이클 중 가장 구체적인(기간이 짧은) 것.
 * 분기·연간이 겹치면 분기가 선택된다. 없으면 null.
 */
export function findCurrentCycle(cycles: Cycle[], today: string = localToday()): Cycle | null {
  const containing = cycles.filter((c) => {
    const start = day(c.startDate);
    const end = day(c.endDate);
    return !!start && !!end && start <= today && today <= end;
  });
  if (containing.length === 0) return null;

  const spanDays = (c: Cycle) =>
    Date.parse(day(c.endDate)) - Date.parse(day(c.startDate));
  return containing.reduce((best, c) => (spanDays(c) < spanDays(best) ? c : best));
}
