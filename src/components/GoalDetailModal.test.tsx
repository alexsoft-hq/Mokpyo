// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoalDetailModal } from './GoalDetailModal';
import { Goal } from '@/types/goal';

// Mock ResizeObserver for radix-ui components
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock api module
vi.mock('@/lib/api', () => ({
  api: {
    uploadAttachment: vi.fn(),
    downloadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  },
}));

const makeGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'goal-1',
  title: 'Test Goal',
  owner: 'Alice',
  owners: ['Alice'],
  progress: 0,
  size: 'medium' as const,
  categories: ['SERVICE'],
  subGoals: [
    { id: 'sg-1', title: '하위 목표 A', owner: 'Alice', owners: ['Alice'], progress: 0 },
    { id: 'sg-2', title: '하위 목표 B', owner: 'Bob', owners: ['Bob'], progress: 50 },
    { id: 'sg-3', title: '하위 목표 C', owner: 'Charlie', owners: ['Charlie'], progress: 100 },
  ],
  notes: [],
  attachments: [],
  ...overrides,
});

// Helper to open Radix dropdown (requires pointerDown)
const openDropdownMenu = (trigger: HTMLElement) => {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
};

describe('GoalDetailModal - Sub-goal reordering', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    categories: ['SERVICE'] as any[],
    categoryColors: {} as Record<string, string>,
    registeredUsers: [],
    existingOwners: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render drag handles for sub-goals', () => {
    render(<GoalDetailModal {...defaultProps} goal={makeGoal()} />);
    const handles = screen.getAllByLabelText('드래그하여 순서 변경');
    expect(handles).toHaveLength(3);
  });

  it('should render sub-goal labels with index numbers', () => {
    render(<GoalDetailModal {...defaultProps} goal={makeGoal()} />);
    expect(screen.getByText('하위 목표 1')).toBeTruthy();
    expect(screen.getByText('하위 목표 2')).toBeTruthy();
    expect(screen.getByText('하위 목표 3')).toBeTruthy();
  });

  it('should render ⋮ menu buttons for each sub-goal', () => {
    render(<GoalDetailModal {...defaultProps} goal={makeGoal()} />);
    expect(screen.getByTestId('subgoal-menu-0')).toBeTruthy();
    expect(screen.getByTestId('subgoal-menu-1')).toBeTruthy();
    expect(screen.getByTestId('subgoal-menu-2')).toBeTruthy();
  });

  it('should show dropdown menu items when ⋮ is clicked', async () => {
    render(<GoalDetailModal {...defaultProps} goal={makeGoal()} />);
    openDropdownMenu(screen.getByTestId('subgoal-menu-1'));

    expect(await screen.findByText('맨 위로 이동')).toBeTruthy();
    expect(screen.getByText('위로 이동')).toBeTruthy();
    expect(screen.getByText('아래로 이동')).toBeTruthy();
    expect(screen.getByText('맨 아래로 이동')).toBeTruthy();
    expect(screen.getByText('삭제')).toBeTruthy();
  });

  it('should move sub-goal to top when "맨 위로 이동" is clicked', async () => {
    const onSave = vi.fn();
    render(<GoalDetailModal {...defaultProps} goal={makeGoal()} onSave={onSave} />);

    openDropdownMenu(screen.getByTestId('subgoal-menu-2'));
    const moveToTop = await screen.findByText('맨 위로 이동');
    fireEvent.click(moveToTop);

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedGoal = onSave.mock.calls[0][0];
    expect(savedGoal.subGoals[0].id).toBe('sg-3');
    expect(savedGoal.subGoals[1].id).toBe('sg-1');
    expect(savedGoal.subGoals[2].id).toBe('sg-2');
  });

  it('should move sub-goal to bottom when "맨 아래로 이동" is clicked', async () => {
    const onSave = vi.fn();
    render(<GoalDetailModal {...defaultProps} goal={makeGoal()} onSave={onSave} />);

    openDropdownMenu(screen.getByTestId('subgoal-menu-0'));
    const moveToBottom = await screen.findByText('맨 아래로 이동');
    fireEvent.click(moveToBottom);

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedGoal = onSave.mock.calls[0][0];
    expect(savedGoal.subGoals[0].id).toBe('sg-2');
    expect(savedGoal.subGoals[1].id).toBe('sg-3');
    expect(savedGoal.subGoals[2].id).toBe('sg-1');
  });

  it('should delete sub-goal from dropdown menu', async () => {
    const onSave = vi.fn();
    render(<GoalDetailModal {...defaultProps} goal={makeGoal()} onSave={onSave} />);

    openDropdownMenu(screen.getByTestId('subgoal-menu-1'));
    const deleteItem = await screen.findByText('삭제');
    fireEvent.click(deleteItem);

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedGoal = onSave.mock.calls[0][0];
    expect(savedGoal.subGoals).toHaveLength(2);
    expect(savedGoal.subGoals[0].id).toBe('sg-1');
    expect(savedGoal.subGoals[1].id).toBe('sg-3');
  });

  it('should not render old standalone move/delete buttons', () => {
    render(<GoalDetailModal {...defaultProps} goal={makeGoal()} />);
    expect(screen.queryByTitle('위로 이동')).toBeNull();
    expect(screen.queryByTitle('아래로 이동')).toBeNull();
    expect(screen.queryByTitle('삭제')).toBeNull();
  });
});
