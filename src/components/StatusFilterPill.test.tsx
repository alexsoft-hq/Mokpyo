// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusFilterPill } from './StatusFilterPill';

describe('StatusFilterPill', () => {
  const defaultProps = {
    showCompleted: false,
    onShowCompletedToggle: vi.fn(),
    completedCount: 3,
    showOnHold: false,
    onShowOnHoldToggle: vi.fn(),
    onHoldCount: 1,
  };

  it('should render completed and on-hold counts', () => {
    render(<StatusFilterPill {...defaultProps} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('should render two buttons', () => {
    render(<StatusFilterPill {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('should call onShowCompletedToggle when completed button is clicked', () => {
    const onToggle = vi.fn();
    render(<StatusFilterPill {...defaultProps} onShowCompletedToggle={onToggle} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should call onShowOnHoldToggle when on-hold button is clicked', () => {
    const onToggle = vi.fn();
    render(<StatusFilterPill {...defaultProps} onShowOnHoldToggle={onToggle} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should apply active style when showCompleted is true', () => {
    render(<StatusFilterPill {...defaultProps} showCompleted={true} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toContain('bg-green-100');
  });

  it('should apply inactive style when showCompleted is false', () => {
    render(<StatusFilterPill {...defaultProps} showCompleted={false} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toContain('text-muted-foreground');
    expect(buttons[0].className).not.toContain('bg-green-100');
  });

  it('should apply active style when showOnHold is true', () => {
    render(<StatusFilterPill {...defaultProps} showOnHold={true} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[1].className).toContain('bg-amber-100');
  });

  it('should apply inactive style when showOnHold is false', () => {
    render(<StatusFilterPill {...defaultProps} showOnHold={false} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[1].className).toContain('text-muted-foreground');
    expect(buttons[1].className).not.toContain('bg-amber-100');
  });

  it('should display zero counts correctly', () => {
    render(<StatusFilterPill {...defaultProps} completedCount={0} onHoldCount={0} />);
    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(2);
  });
});
