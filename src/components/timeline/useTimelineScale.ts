import { useMemo, useCallback, useRef } from 'react';
import { Goal } from '@/types/goal';

export type ZoomLevel = 'week' | 'month' | 'quarter';

export interface TimelineColumn {
  label: string;
  startX: number;
  width: number;
  date: Date;
}

export interface TimelineMonthGroup {
  label: string;
  startX: number;
  width: number;
}

export interface TimelineScale {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  dayWidth: number;
  columns: TimelineColumn[];
  monthGroups: TimelineMonthGroup[];
  dateToX: (date: Date) => number;
  totalWidth: number;
}

const DAY_WIDTH: Record<ZoomLevel, number> = {
  week: 40,
  month: 12,
  quarter: 4,
};

const MS_PER_DAY = 86400000;

// Simple date helpers (avoid date-fns overhead)
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-');
  return new Date(+y, +m - 1, +d);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeekMon(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - ((day + 6) % 7)); // Monday
  return r;
}

function endOfWeekSun(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? 0 : 7 - day)); // Sunday
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatMonthLabel(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

function collectTimestamps(goals: Goal[]): number[] {
  const ts: number[] = [];
  for (const goal of goals) {
    if (goal.startDate) ts.push(parseDate(goal.startDate).getTime());
    if (goal.dueDate) ts.push(parseDate(goal.dueDate).getTime());
    if (goal.subGoals) {
      for (const sub of goal.subGoals) {
        if (sub.startDate) ts.push(parseDate(sub.startDate).getTime());
        if (sub.dueDate) ts.push(parseDate(sub.dueDate).getTime());
      }
    }
  }
  return ts;
}

export function useTimelineScale(goals: Goal[], zoomLevel: ZoomLevel): TimelineScale {
  // Keep stable dateToX reference across renders when startTime/dayWidth don't change
  const dateToXRef = useRef<{ startTime: number; dayWidth: number; fn: (date: Date) => number }>({
    startTime: 0, dayWidth: 0, fn: () => 0,
  });

  const result = useMemo(() => {
    const timestamps = collectTimestamps(goals);
    const today = new Date();

    let minDate: Date;
    let maxDate: Date;

    if (timestamps.length === 0) {
      minDate = addDays(today, -30);
      maxDate = addDays(today, 30);
    } else {
      minDate = new Date(Math.min(...timestamps));
      maxDate = new Date(Math.max(...timestamps));
    }

    // Add padding
    const paddingDays = zoomLevel === 'week' ? 7 : zoomLevel === 'month' ? 14 : 30;
    const startDate = startOfWeekMon(addDays(minDate, -paddingDays));
    const endDate = endOfWeekSun(addDays(maxDate, paddingDays));

    const totalDays = diffDays(endDate, startDate) + 1;
    const dayWidth = DAY_WIDTH[zoomLevel];
    const totalWidth = totalDays * dayWidth;

    const startTime = startDate.getTime();
    // dateToX is created inside useMemo but will be swapped for a stable ref below
    const dateToX = (date: Date): number => {
      return Math.round((date.getTime() - startTime) / MS_PER_DAY) * dayWidth;
    };

    // Build columns based on zoom level
    const columns: TimelineColumn[] = [];

    if (zoomLevel === 'week') {
      // Show individual days
      const d = new Date(startDate);
      while (d <= endDate) {
        columns.push({
          label: `${d.getDate()}`,
          startX: dateToX(d),
          width: dayWidth,
          date: new Date(d),
        });
        d.setDate(d.getDate() + 1);
      }
    } else if (zoomLevel === 'month') {
      // Show weeks (Monday starts)
      let weekStart = new Date(startDate);
      while (weekStart <= endDate) {
        const nextWeek = addDays(weekStart, 7);
        const weekEnd = nextWeek <= endDate ? addDays(nextWeek, -1) : endDate;
        const days = diffDays(weekEnd, weekStart) + 1;
        columns.push({
          label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
          startX: dateToX(weekStart),
          width: days * dayWidth,
          date: new Date(weekStart),
        });
        weekStart = nextWeek;
      }
    } else {
      // Quarter: show months
      let mStart = startOfMonth(startDate);
      while (mStart <= endDate) {
        const nextMonth = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 1);
        const mEnd = nextMonth <= endDate ? addDays(nextMonth, -1) : endDate;
        const days = diffDays(mEnd, mStart) + 1;
        columns.push({
          label: `${mStart.getMonth() + 1}월`,
          startX: dateToX(mStart),
          width: days * dayWidth,
          date: new Date(mStart),
        });
        mStart = nextMonth;
      }
    }

    // Build month groups for top header row
    const monthGroups: TimelineMonthGroup[] = [];
    let mgStart = startOfMonth(startDate);
    while (mgStart <= endDate) {
      const nextMonth = new Date(mgStart.getFullYear(), mgStart.getMonth() + 1, 1);
      const mgEnd = new Date(Math.min(endOfMonth(mgStart).getTime(), endDate.getTime()));
      const days = diffDays(mgEnd, mgStart) + 1;
      monthGroups.push({
        label: formatMonthLabel(mgStart),
        startX: dateToX(mgStart),
        width: days * dayWidth,
      });
      mgStart = nextMonth;
    }

    return {
      startDate,
      endDate,
      totalDays,
      dayWidth,
      columns,
      monthGroups,
      dateToX,
      totalWidth,
      _startTime: startTime,
    };
  }, [goals, zoomLevel]);

  // Stabilize dateToX reference: only create a new function when startTime or dayWidth actually change
  if (result._startTime !== dateToXRef.current.startTime || result.dayWidth !== dateToXRef.current.dayWidth) {
    dateToXRef.current = {
      startTime: result._startTime,
      dayWidth: result.dayWidth,
      fn: result.dateToX,
    };
  }

  return {
    ...result,
    dateToX: dateToXRef.current.fn,
  };
}
