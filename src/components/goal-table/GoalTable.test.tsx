// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoalTable } from './GoalTable';
import { Goal } from '@/types/goal';
import { FieldSchema } from '@/types/fields';

const schema: FieldSchema = {
  statusLabels: [
    { id: 'ip', organizationId: 'o', name: '진행 중', color: '#3b82f6', kind: 'active', order: 1, isSystem: true },
    { id: 'done', organizationId: 'o', name: '완료', color: '#22c55e', kind: 'done', order: 4, isSystem: true },
  ],
  customFields: [
    { id: 'f1', projectId: 'p', name: '예산', type: 'number', config: { unit: '만원' }, order: 0 },
  ],
};

const goals: Goal[] = [
  { id: 'g1', title: '목표 하나', owner: '갑', owners: ['갑'], categories: ['A'], progress: 40, size: 'medium', statusId: 'ip', customFields: { f1: 1500 } } as Goal,
  { id: 'g2', title: '목표 둘', owner: '을', owners: ['을'], categories: ['B'], progress: 100, size: 'large', statusId: 'done', completed: true, customFields: {} } as Goal,
];

const noop = () => {};

function renderTable(groupBy: any = 'status') {
  return render(
    <GoalTable
      goals={goals}
      schema={schema}
      users={[]}
      cycles={[]}
      groupBy={groupBy}
      sorting={[]}
      onSortingChange={noop}
      columnVisibility={{}}
      onColumnVisibilityChange={noop}
      collapsedGroups={new Set()}
      onToggleGroup={noop}
      onStatusChange={noop}
      onPatch={noop}
      onFieldChange={noop}
      onOpenPanel={noop}
    />
  );
}

describe('GoalTable', () => {
  it('목표 행과 제목을 렌더', () => {
    renderTable();
    expect(screen.getByText('목표 하나')).toBeInTheDocument();
    expect(screen.getByText('목표 둘')).toBeInTheDocument();
  });

  it('상태별 그룹 헤더를 렌더(건수 표기)', () => {
    renderTable('status');
    // 그룹 헤더 라벨(진행 중/완료)이 상태 필과 별개로 그룹행에 노출
    expect(screen.getAllByText('진행 중').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1건/).length).toBe(2); // 진행 중 1건 + 완료 1건
  });

  it('커스텀 필드 컬럼 헤더와 값 렌더', () => {
    renderTable('none');
    expect(screen.getByText('예산')).toBeInTheDocument();
    expect(screen.getByText(/1500/)).toBeInTheDocument();
  });
});
