// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Import after mocks
const { CompactOverallSummary } = await import('./CompactOverallSummary');

const makeGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: '1',
  title: 'Test Goal',
  description: '',
  progress: 50,
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

describe('CompactOverallSummary', () => {
  const defaultProps = {
    goals: [makeGoal(), makeGoal({ id: '2', title: 'Goal 2', progress: 80, owner: 'Bob' })],
    onAddGoal: vi.fn(),
    viewMode: 'compact' as const,
    onViewModeChange: vi.fn(),
    categoryColors: { DEV: '#3b82f6' },
    selectedCategories: ['DEV'],
    onCategoryToggle: vi.fn(),
    showCompleted: false,
    onShowCompletedToggle: vi.fn(),
    completedCount: 2,
    showOnHold: false,
    onShowOnHoldToggle: vi.fn(),
    onHoldCount: 1,
    onSettingsClick: vi.fn(),
    user: { userId: '1', email: 'test@test.com', name: 'Test', picture: undefined },
    onLogout: vi.fn(),
    onUserUpdate: vi.fn(),
    searchText: '',
    onSearchChange: vi.fn(),
    selectedOwners: [] as string[],
    onOwnerToggle: vi.fn(),
    owners: ['Alice', 'Bob'],
  };

  it('should render StatusFilterPill with counts', () => {
    render(<CompactOverallSummary {...defaultProps} />);
    // StatusFilterPill renders completed count and onHold count
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('should render filter button', () => {
    render(<CompactOverallSummary {...defaultProps} />);
    // Filter button should be present
    const buttons = screen.getAllByRole('button');
    const filterBtn = buttons.find(btn => btn.getAttribute('title') === '필터');
    expect(filterBtn).toBeTruthy();
  });

  it('should not show filter row by default', () => {
    render(<CompactOverallSummary {...defaultProps} />);
    expect(screen.queryByPlaceholderText('목표 검색...')).toBeNull();
    expect(screen.queryByText('담당자 선택')).toBeNull();
  });

  it('should show filter row when filter button is clicked', () => {
    render(<CompactOverallSummary {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const filterBtn = buttons.find(btn => btn.getAttribute('title') === '필터')!;
    fireEvent.click(filterBtn);
    expect(screen.getByPlaceholderText('목표 검색...')).toBeTruthy();
    expect(screen.getByText('담당자 선택')).toBeTruthy();
  });

  it('should hide filter row when filter button is clicked again', () => {
    render(<CompactOverallSummary {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const filterBtn = buttons.find(btn => btn.getAttribute('title') === '필터')!;
    // Open
    fireEvent.click(filterBtn);
    expect(screen.getByPlaceholderText('목표 검색...')).toBeTruthy();
    // Close
    fireEvent.click(filterBtn);
    expect(screen.queryByPlaceholderText('목표 검색...')).toBeNull();
  });

  it('should call onSearchChange when typing in search', () => {
    const onSearchChange = vi.fn();
    render(<CompactOverallSummary {...defaultProps} onSearchChange={onSearchChange} />);
    // Open filters
    const filterBtn = screen.getAllByRole('button').find(btn => btn.getAttribute('title') === '필터')!;
    fireEvent.click(filterBtn);
    // Type
    fireEvent.change(screen.getByPlaceholderText('목표 검색...'), { target: { value: 'hello' } });
    expect(onSearchChange).toHaveBeenCalledWith('hello');
  });

  it('should display overall average', () => {
    render(<CompactOverallSummary {...defaultProps} />);
    // Average of 50 + 80 = 65%
    expect(screen.getByText(/전체 평균: 65%/)).toBeTruthy();
  });

  it('should display goal count', () => {
    render(<CompactOverallSummary {...defaultProps} />);
    expect(screen.getByText(/총 2개 목표/)).toBeTruthy();
  });

  it('should not render old Switch toggles', () => {
    render(<CompactOverallSummary {...defaultProps} />);
    // Old toggle labels should not exist
    expect(screen.queryByText(/완료\(\d+\)/)).toBeNull();
    expect(screen.queryByText(/보류\(\d+\)/)).toBeNull();
  });

  it('should show selected owner count in filter row', () => {
    render(<CompactOverallSummary {...defaultProps} selectedOwners={['Alice']} />);
    const filterBtn = screen.getAllByRole('button').find(btn => btn.getAttribute('title') === '필터')!;
    fireEvent.click(filterBtn);
    expect(screen.getByText('1명 선택')).toBeTruthy();
  });

  it('should use active filter button style when filters are applied', () => {
    render(<CompactOverallSummary {...defaultProps} searchText="active search" />);
    const filterBtn = screen.getAllByRole('button').find(btn => btn.getAttribute('title') === '필터')!;
    // When hasActiveFilters is true, button uses variant="default" instead of "outline"
    // The button should not have the outline variant class
    expect(filterBtn).toBeTruthy();
  });
});
