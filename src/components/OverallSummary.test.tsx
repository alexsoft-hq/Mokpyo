// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Goal } from '@/types/goal';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('./ProjectSelector', () => ({
  ProjectSelector: () => <div data-testid="project-selector">ProjectSelector</div>,
}));

vi.mock('./UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

vi.mock('./WorkspaceSelector', () => ({
  default: () => <div data-testid="workspace-selector">WorkspaceSelector</div>,
}));

vi.mock('./NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">NotificationBell</div>,
}));

const { OverallSummary } = await import('./OverallSummary');

const makeGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: '1',
  title: 'Test Goal',
  description: '',
  progress: 60,
  owner: 'Alice',
  owners: ['Alice'],
  size: 'medium',
  categories: ['DEV'],
  subGoals: [],
  completed: false,
  onHold: false,
  order: 0,
  ...overrides,
});

describe('OverallSummary', () => {
  const goals = [
    makeGoal(),
    makeGoal({ id: '2', title: 'Goal 2', progress: 40, owner: 'Bob' }),
  ];

  const defaultProps = {
    goals,
    filteredGoals: goals,
    onAddGoal: vi.fn(),
    categoryColors: { DEV: '#3b82f6' },
    viewMode: 'normal' as const,
    onViewModeChange: vi.fn(),
    searchText: '',
    onSearchChange: vi.fn(),
    selectedOwners: [] as string[],
    onOwnerToggle: vi.fn(),
    selectedCategories: ['DEV'],
    onCategoryToggle: vi.fn(),
    owners: ['Alice', 'Bob'],
    categories: ['DEV'],
    showCompleted: false,
    onShowCompletedToggle: vi.fn(),
    completedCount: 5,
    showOnHold: false,
    onShowOnHoldToggle: vi.fn(),
    onHoldCount: 2,
    onSettingsClick: vi.fn(),
    user: { userId: '1', email: 'test@test.com', name: 'Test', picture: undefined },
    onLogout: vi.fn(),
    onUserUpdate: vi.fn(),
  };

  it('should render StatusFilterPill with completed and onHold counts', () => {
    render(<OverallSummary {...defaultProps} />);
    expect(screen.getByText('5')).toBeTruthy();
    // onHoldCount "2" appears in the pill; also "2개" exists as goal count text
    const twos = screen.getAllByText('2');
    expect(twos.length).toBeGreaterThanOrEqual(1);
  });

  it('should render StatusFilterPill in all view modes', () => {
    // normal mode
    const { unmount: u1 } = render(<OverallSummary {...defaultProps} viewMode="normal" />);
    expect(screen.getByText('5')).toBeTruthy(); // completedCount
    u1();

    // compact mode
    const { unmount: u2 } = render(<OverallSummary {...defaultProps} viewMode="compact" />);
    expect(screen.getByText('5')).toBeTruthy();
    u2();
  });

  it('should render FilterBar without toggles in normal mode', () => {
    render(<OverallSummary {...defaultProps} viewMode="normal" />);
    // FilterBar should have search input
    expect(screen.getByPlaceholderText('목표 검색...')).toBeTruthy();
    // Old Switch toggle labels should not exist in FilterBar
    expect(screen.queryByText(/완료\(\d+\)/)).toBeNull();
    expect(screen.queryByText(/보류\(\d+\)/)).toBeNull();
  });

  it('should display overall average', () => {
    render(<OverallSummary {...defaultProps} />);
    // (60 + 40) / 2 = 50, appears in both overall and filtered sections
    const matches = screen.getAllByText('50%');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should display total goal count', () => {
    render(<OverallSummary {...defaultProps} />);
    // "2개" appears in multiple places (goal count, category stats, filtered count)
    const matches = screen.getAllByText(/2개/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should not render old Switch-based toggles', () => {
    render(<OverallSummary {...defaultProps} viewMode="normal" />);
    // 이전 목록(list) 모드에 있던 Switch 토글("완료(N)" / "보류(N)")은 더 이상 없어야 함
    expect(screen.queryByText(/완료\(\d+\)/)).toBeNull();
    expect(screen.queryByText(/보류\(\d+\)/)).toBeNull();
  });
});
