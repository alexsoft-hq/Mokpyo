import { describe, it, expect } from 'vitest';
import { effectiveRange, goalOverlapsCycle } from './cycleOverlap';

const Q3 = { startDate: '2026-07-01', endDate: '2026-09-30' };

describe('effectiveRange', () => {
  it('시작일+마감일 모두 있으면 그대로', () => {
    expect(effectiveRange({ startDate: '2026-07-01', dueDate: '2026-08-15' })).toEqual({
      start: '2026-07-01',
      end: '2026-08-15',
    });
  });

  it('마감일만 있으면 그 날 하루', () => {
    expect(effectiveRange({ startDate: null, dueDate: '2026-08-15' })).toEqual({
      start: '2026-08-15',
      end: '2026-08-15',
    });
  });

  it('시작일만 있으면 그 날 하루', () => {
    expect(effectiveRange({ startDate: '2026-08-15', dueDate: '' })).toEqual({
      start: '2026-08-15',
      end: '2026-08-15',
    });
  });

  it('둘 다 없으면 null', () => {
    expect(effectiveRange({ startDate: null, dueDate: null })).toBeNull();
    expect(effectiveRange({ startDate: '', dueDate: '' })).toBeNull();
  });

  it('ISO 날짜시간 문자열은 날짜부만 사용', () => {
    expect(effectiveRange({ startDate: '2026-07-01T09:00:00.000Z', dueDate: null })).toEqual({
      start: '2026-07-01',
      end: '2026-07-01',
    });
  });
});

describe('goalOverlapsCycle', () => {
  it('사이클 안에 완전히 포함되면 겹침', () => {
    expect(goalOverlapsCycle({ startDate: '2026-07-10', dueDate: '2026-08-20' }, Q3)).toBe(true);
  });

  it('사이클을 걸치기만 해도 겹침 (앞뒤 일부)', () => {
    expect(goalOverlapsCycle({ startDate: '2026-06-01', dueDate: '2026-07-05' }, Q3)).toBe(true);
    expect(goalOverlapsCycle({ startDate: '2026-09-25', dueDate: '2026-11-30' }, Q3)).toBe(true);
  });

  it('사이클을 완전히 감싸는 장기 목표도 겹침', () => {
    expect(goalOverlapsCycle({ startDate: '2026-01-01', dueDate: '2026-12-31' }, Q3)).toBe(true);
  });

  it('경계일 정확히 일치해도 겹침 (포함 비교)', () => {
    expect(goalOverlapsCycle({ startDate: '2026-05-01', dueDate: '2026-07-01' }, Q3)).toBe(true);
    expect(goalOverlapsCycle({ startDate: '2026-09-30', dueDate: '2026-10-30' }, Q3)).toBe(true);
  });

  it('사이클 밖이면 안 겹침', () => {
    expect(goalOverlapsCycle({ startDate: '2026-01-01', dueDate: '2026-06-30' }, Q3)).toBe(false);
    expect(goalOverlapsCycle({ startDate: '2026-10-01', dueDate: '2026-12-31' }, Q3)).toBe(false);
  });

  it('마감일만 있는 목표는 마감일 기준', () => {
    expect(goalOverlapsCycle({ dueDate: '2026-08-15' }, Q3)).toBe(true);
    expect(goalOverlapsCycle({ dueDate: '2026-06-15' }, Q3)).toBe(false);
  });

  it('날짜 없는 목표는 항상 안 겹침', () => {
    expect(goalOverlapsCycle({}, Q3)).toBe(false);
  });
});
