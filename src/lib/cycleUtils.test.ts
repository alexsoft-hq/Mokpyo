import { describe, it, expect } from 'vitest';
import { findCurrentCycle, localToday } from './cycleUtils';
import { Cycle } from '@/lib/api';

const cycle = (id: string, startDate: string, endDate: string): Cycle => ({
  id,
  organizationId: 'org1',
  name: id,
  type: 'quarter',
  startDate,
  endDate,
  createdAt: '',
  updatedAt: '',
});

describe('findCurrentCycle', () => {
  it('오늘을 포함하는 사이클을 반환', () => {
    const q3 = cycle('q3', '2026-07-01', '2026-09-30');
    expect(findCurrentCycle([q3], '2026-07-03')?.id).toBe('q3');
  });

  it('경계일(시작일·종료일 당일)도 포함', () => {
    const q3 = cycle('q3', '2026-07-01', '2026-09-30');
    expect(findCurrentCycle([q3], '2026-07-01')?.id).toBe('q3');
    expect(findCurrentCycle([q3], '2026-09-30')?.id).toBe('q3');
  });

  it('포함하는 사이클이 없으면 null', () => {
    const q3 = cycle('q3', '2026-07-01', '2026-09-30');
    expect(findCurrentCycle([q3], '2026-06-30')).toBeNull();
    expect(findCurrentCycle([], '2026-07-03')).toBeNull();
  });

  it('분기·연간이 겹치면 기간이 짧은 분기를 선택', () => {
    const annual = cycle('annual', '2026-01-01', '2026-12-31');
    const q3 = cycle('q3', '2026-07-01', '2026-09-30');
    expect(findCurrentCycle([annual, q3], '2026-08-15')?.id).toBe('q3');
    expect(findCurrentCycle([q3, annual], '2026-08-15')?.id).toBe('q3');
  });

  it('ISO 날짜시간 문자열도 날짜부로 판정', () => {
    const q3 = cycle('q3', '2026-07-01T00:00:00.000Z', '2026-09-30T00:00:00.000Z');
    expect(findCurrentCycle([q3], '2026-08-15')?.id).toBe('q3');
  });
});

describe('localToday', () => {
  it('로컬 타임존 기준 YYYY-MM-DD (UTC 밀림 없음)', () => {
    // KST 2026-07-03 01:00 = UTC 2026-07-02 16:00 — 로컬 기준 7/3이어야 한다
    const kstMidnightish = new Date(2026, 6, 3, 1, 0, 0);
    expect(localToday(kstMidnightish)).toBe('2026-07-03');
  });
});
