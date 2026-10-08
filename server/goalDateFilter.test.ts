import { describe, it, expect } from 'vitest';
import { buildCompletedDateFilter } from './goalDateFilter';

describe('buildCompletedDateFilter', () => {
  it('returns undefined when no date params provided', () => {
    expect(buildCompletedDateFilter()).toBeUndefined();
    expect(buildCompletedDateFilter(undefined, undefined)).toBeUndefined();
  });

  it('returns OR clauses when dateFrom is provided', () => {
    const result = buildCompletedDateFilter('2026-01-01');
    expect(result).toBeDefined();
    expect(result).toHaveLength(4);

    // Non-completed goals always included
    expect(result![0]).toEqual({ completed: false });

    // Completed without startDate included
    expect(result![1]).toEqual({ completed: true, startDate: null });

    // Completed without dueDate included
    expect(result![2]).toEqual({ completed: true, dueDate: null });

    // Completed with dates: dueDate must be >= dateFrom
    expect(result![3]).toEqual({
      completed: true,
      dueDate: { gte: '2026-01-01' },
    });
  });

  it('returns OR clauses when dateTo is provided', () => {
    const result = buildCompletedDateFilter(undefined, '2026-12-31');
    expect(result).toBeDefined();

    // Completed with dates: startDate must be <= dateTo
    expect(result![3]).toEqual({
      completed: true,
      startDate: { lte: '2026-12-31' },
    });
  });

  it('returns OR clauses when both dateFrom and dateTo are provided', () => {
    const result = buildCompletedDateFilter('2026-01-01', '2026-12-31');
    expect(result).toBeDefined();

    // Completed with dates: overlapping range check
    expect(result![3]).toEqual({
      completed: true,
      dueDate: { gte: '2026-01-01' },
      startDate: { lte: '2026-12-31' },
    });
  });

  it('always includes non-completed goals regardless of date range', () => {
    const result = buildCompletedDateFilter('2026-01-01', '2026-12-31');
    const nonCompletedClause = result!.find(
      (clause: any) => clause.completed === false
    );
    expect(nonCompletedClause).toBeDefined();
  });

  it('always includes completed goals without dates', () => {
    const result = buildCompletedDateFilter('2026-01-01', '2026-12-31');
    const nullStartDate = result!.find(
      (clause: any) => clause.completed === true && clause.startDate === null
    );
    const nullDueDate = result!.find(
      (clause: any) => clause.completed === true && clause.dueDate === null
    );
    expect(nullStartDate).toBeDefined();
    expect(nullDueDate).toBeDefined();
  });
});
