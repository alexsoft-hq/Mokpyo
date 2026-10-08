import { describe, it, expect } from 'vitest';
import { groupGoals } from './groupGoals';
import { Goal } from '@/types/goal';
import { StatusLabel } from '@/types/fields';

const labels: StatusLabel[] = [
  { id: 'ns', organizationId: 'o', name: '시작 전', color: '#94a3b8', kind: 'active', order: 0, isSystem: true },
  { id: 'ip', organizationId: 'o', name: '진행 중', color: '#3b82f6', kind: 'active', order: 1, isSystem: true },
  { id: 'done', organizationId: 'o', name: '완료', color: '#22c55e', kind: 'done', order: 4, isSystem: true },
];
const statusById = new Map(labels.map((l) => [l.id, l]));
const cycleById = new Map([['c1', { id: 'c1', name: '3분기' }]]);

const g = (over: Partial<Goal>): Goal => ({
  id: Math.random().toString(), title: 't', owner: '', owners: [], categories: ['A'], progress: 0, size: 'medium', ...over,
} as Goal);

const ctx = { statusById, cycleById };

describe('groupGoals', () => {
  it("groupBy 'none' 은 단일 그룹", () => {
    const gs = [g({}), g({})];
    const res = groupGoals(gs, 'none', ctx);
    expect(res).toHaveLength(1);
    expect(res[0].count).toBe(2);
  });

  it('상태별 그룹 + 라벨 order 정렬 + 평균/완료 집계', () => {
    const gs = [
      g({ statusId: 'ip', progress: 50 }),
      g({ statusId: 'done', progress: 100, completed: true }),
      g({ statusId: 'ip', progress: 30 }),
    ];
    const res = groupGoals(gs, 'status', ctx);
    expect(res.map((x) => x.label)).toEqual(['진행 중', '완료']); // order 1, 4
    const ip = res[0];
    expect(ip.count).toBe(2);
    expect(ip.avgProgress).toBe(40);
    const done = res[1];
    expect(done.doneCount).toBe(1);
    expect(done.color).toBe('#22c55e');
  });

  it('statusId 없으면 상태 없음 그룹(말미)', () => {
    const gs = [g({ statusId: 'ip' }), g({ statusId: null })];
    const res = groupGoals(gs, 'status', ctx);
    expect(res[res.length - 1].label).toBe('상태 없음');
    expect(res[res.length - 1].key).toBe('__none__');
  });

  it('담당자별: 첫 담당자 기준(행 중복 없음)', () => {
    const gs = [g({ owners: ['갑', '을'] }), g({ owners: ['갑'] }), g({ owners: [] })];
    const res = groupGoals(gs, 'owner', ctx);
    const gap = res.find((r) => r.label === '갑');
    expect(gap?.count).toBe(2); // '을' 그룹에는 중복 출현 안 함
    expect(res.some((r) => r.label === '을')).toBe(false);
    expect(res[res.length - 1].label).toBe('담당자 없음');
  });

  it('사이클별: 이름 매핑 + 미배정 말미', () => {
    const gs = [g({ cycleId: 'c1' }), g({ cycleId: null })];
    const res = groupGoals(gs, 'cycle', ctx);
    expect(res[0].label).toBe('3분기');
    expect(res[1].label).toBe('사이클 없음');
  });
});
