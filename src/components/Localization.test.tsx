// @vitest-environment jsdom
import { act, render, renderHook, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/i18n';
import { ProductPreview } from './marketing/ProductPreview';
import { PlanCard } from './marketing/PlanCard';
import { PLANS } from './marketing/plans';
import { useTimelineScale } from './timeline/useTimelineScale';
import { CategoryStatStrip } from './CategoryStatStrip';
import { CompactGoalCard } from './CompactGoalCard';
import { groupGoals } from './goal-table/groupGoals';
import type { Goal } from '@/types/goal';

const goal: Goal = {
  id: 'goal', title: '사용자가 작성한 목표', owner: '사용자', owners: ['사용자'],
  categories: [], size: 'medium', progress: 0,
  startDate: '2026-03-01', dueDate: '2026-03-31',
};

afterEach(async () => {
  cleanup();
  await act(async () => { await setLanguage('ko'); });
});

describe('component localization', () => {
  it('updates static preview labels and plan features without remounting', async () => {
    render(<><ProductPreview /><PlanCard plan={PLANS[0]} /></>);
    expect(screen.getByText('카드')).toBeInTheDocument();
    expect(screen.getByText('개인·조직·상업적 사용 가능')).toBeInTheDocument();
    await act(async () => { await setLanguage('en'); });
    expect(screen.getByText('Cards')).toBeInTheDocument();
    expect(screen.getByText('Self-host')).toBeInTheDocument();
    expect(screen.getByText('Personal, organizational and commercial use')).toBeInTheDocument();
    expect(screen.queryByText('개인·조직·상업적 사용 가능')).not.toBeInTheDocument();
  });

  it('recomputes memoized timeline headings after a language switch', async () => {
    const goals = [goal];
    const { result } = renderHook(() => useTimelineScale(goals, 'quarter'));
    expect(result.current.monthGroups.some(group => group.label.includes('년'))).toBe(true);
    await act(async () => { await setLanguage('en'); });
    expect(result.current.monthGroups.some(group => group.label === 'March 2026')).toBe(true);
    expect(result.current.columns.some(column => column.label === 'Mar')).toBe(true);
  });

  it('translates built-in grouping labels and preserves user-authored names', async () => {
    await act(async () => { await setLanguage('en'); });
    const context = { statusById: new Map(), cycleById: new Map() };
    expect(groupGoals([goal], 'status', context)[0].label).toBe('No status');
    const ownerGroup = groupGoals([goal], 'owner', context)[0];
    expect(ownerGroup.label).toBe('사용자');
    expect(ownerGroup.goals[0].title).toBe('사용자가 작성한 목표');
  });

  it('uses count-safe category labels and accessible compact-card controls', async () => {
    await act(async () => { await setLanguage('en'); });
    render(<>
      <CategoryStatStrip stats={{ Operations: { count: 1, totalProgress: 25 } }} selected={[]} onToggle={() => {}} />
      <CompactGoalCard goal={{ ...goal, owner: 'Sam Rivera', owners: ['Sam Rivera', 'Ari Kim'] }}
        onClick={() => {}} onToggleComplete={() => {}} onToggleOnHold={() => {}} />
    </>);
    expect(screen.getByTitle('Operations · Goals: 1 · 25% average')).toBeInTheDocument();
    expect(screen.getByText('1 more')).toBeInTheDocument();
    expect(screen.getByTitle('Sam Rivera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as completed' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Put on hold' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/1 (items|people)/)).not.toBeInTheDocument();
    await act(async () => { await setLanguage('ko'); });
    expect(screen.getByText('외 1명')).toBeInTheDocument();
    expect(screen.getByTitle('Operations · 1개 · 평균 25%')).toBeInTheDocument();
  });

});
