import { describe, it, expect } from 'vitest';
import { summarize, byStatus, byOwner, byCategory, upcomingDeadlines, addDaysStr } from './dashboardAggregation';
import { Goal } from '@/types/goal';
import { StatusLabel } from '@/types/fields';

const labels: StatusLabel[] = [
  { id: 'ip', organizationId: 'o', name: '진행 중', color: '#3b82f6', kind: 'active', order: 1, isSystem: true },
  { id: 'done', organizationId: 'o', name: '완료', color: '#22c55e', kind: 'done', order: 4, isSystem: true },
];
const g = (o: Partial<Goal>): Goal => ({ id: Math.random().toString(), title: 't', owner: '', owners: [], categories: ['A'], progress: 0, size: 'medium', ...o } as Goal);

describe('dashboardAggregation', () => {
  it('summarize: 총계·평균·완료·보류', () => {
    const s = summarize([g({ progress: 100, completed: true }), g({ progress: 50 }), g({ progress: 0, onHold: true })]);
    expect(s).toEqual({ total: 3, completed: 1, onHold: 1, avgProgress: 50 });
  });

  it('byStatus: 라벨 order 정렬 + 상태없음 말미', () => {
    const res = byStatus([g({ statusId: 'done' }), g({ statusId: 'ip' }), g({ statusId: null })], labels);
    expect(res.map((b) => b.label)).toEqual(['진행 중', '완료', '상태 없음']);
    expect(res[0].color).toBe('#3b82f6');
  });

  it('byOwner: 첫 담당자 기준 내림차순', () => {
    const res = byOwner([g({ owners: ['갑'] }), g({ owners: ['갑'] }), g({ owners: ['을'] })]);
    expect(res[0]).toMatchObject({ label: '갑', count: 2 });
  });

  it('byCategory: 첫 분류 집계', () => {
    const res = byCategory([g({ categories: ['A'] }), g({ categories: ['B'] }), g({ categories: ['A'] })]);
    expect(res.find((b) => b.label === 'A')?.count).toBe(2);
  });

  it('upcomingDeadlines: 미완료·기간내·오름차순', () => {
    const res = upcomingDeadlines([
      g({ dueDate: '2026-07-10' }),
      g({ dueDate: '2026-07-08' }),
      g({ dueDate: '2026-08-30' }),      // 범위 밖
      g({ dueDate: '2026-07-09', completed: true }), // 완료 제외
    ], '2026-07-06', 14);
    expect(res.map((x) => x.dueDate)).toEqual(['2026-07-08', '2026-07-10']);
  });

  it('addDaysStr: 타임존 무관 정확한 날짜 덧셈(off-by-one 방지)', () => {
    expect(addDaysStr('2026-07-07', 14)).toBe('2026-07-21');
    expect(addDaysStr('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysStr('2026-02-28', 1)).toBe('2026-03-01'); // 2026 평년
  });

  it('upcomingDeadlines: 정확히 N일 뒤 마감도 포함(경계)', () => {
    // 코드리뷰 C: KST 등에서 14일 뒤가 누락되던 버그 회귀 방지
    const res = upcomingDeadlines([g({ dueDate: '2026-07-21' })], '2026-07-07', 14);
    expect(res.map((x) => x.dueDate)).toEqual(['2026-07-21']);
  });
});
