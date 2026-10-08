// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  const defaultProps = {
    searchText: '',
    onSearchChange: vi.fn(),
    selectedOwners: [] as string[],
    onOwnerToggle: vi.fn(),
    owners: ['Alice', 'Bob', 'Charlie'],
  };

  it('should render search input', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('목표 검색...')).toBeTruthy();
  });

  it('should render filter heading', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText('필터')).toBeTruthy();
  });

  it('should render owner select button', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText('담당자 선택')).toBeTruthy();
  });

  it('should show selected owner count', () => {
    render(<FilterBar {...defaultProps} selectedOwners={['Alice', 'Bob']} />);
    expect(screen.getByText('2명 선택')).toBeTruthy();
  });

  it('should call onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(<FilterBar {...defaultProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByPlaceholderText('목표 검색...'), { target: { value: 'test' } });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('should display current search text', () => {
    render(<FilterBar {...defaultProps} searchText="검색어" />);
    expect(screen.getByDisplayValue('검색어')).toBeTruthy();
  });

  it('should not render completed/onHold toggles (removed)', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.queryByText(/완료/)).toBeNull();
    expect(screen.queryByText(/보류/)).toBeNull();
  });

  it('should show empty state when no owners', () => {
    render(<FilterBar {...defaultProps} owners={[]} />);
    // Click the owner button to open popover
    fireEvent.click(screen.getByText('담당자 선택'));
    expect(screen.getByText('담당자가 없습니다')).toBeTruthy();
  });
});
