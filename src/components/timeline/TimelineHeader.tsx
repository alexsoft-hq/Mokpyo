import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { type TimelineScale, type ZoomLevel } from './useTimelineScale';

const todayStr = new Date().toDateString();
const checkToday = (d: Date) => d.toDateString() === todayStr;
const checkWeekend = (d: Date) => { const day = d.getDay(); return day === 0 || day === 6; };

interface TimelineHeaderProps {
  scale: TimelineScale;
  zoomLevel: ZoomLevel;
  nameColumnWidth: number;
  visibleRange: { left: number; right: number };
}

export const TimelineHeader = memo(function TimelineHeader({
  scale,
  zoomLevel,
  nameColumnWidth,
  visibleRange,
}: TimelineHeaderProps) {
  // Filter columns to only those overlapping the visible range
  const visibleColumns = useMemo(() =>
    scale.columns.filter(col => {
      const colEnd = col.startX + col.width;
      return colEnd >= visibleRange.left && col.startX <= visibleRange.right;
    }),
    [scale.columns, visibleRange.left, visibleRange.right]
  );

  // Filter month groups similarly
  const visibleMonthGroups = useMemo(() =>
    scale.monthGroups.filter(group => {
      const groupEnd = group.startX + group.width;
      return groupEnd >= visibleRange.left && group.startX <= visibleRange.right;
    }),
    [scale.monthGroups, visibleRange.left, visibleRange.right]
  );

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background">
      {/* Month groups row */}
      <div className="flex border-b border-border" style={{ paddingLeft: `${nameColumnWidth}px` }}>
        <div className="relative" style={{ width: `${scale.totalWidth}px`, height: '28px' }}>
          {visibleMonthGroups.map((group, i) => (
            <div
              key={i}
              className="absolute top-0 h-full flex items-center justify-center border-r border-border text-xs font-medium text-muted-foreground"
              style={{ left: `${group.startX}px`, width: `${group.width}px` }}
            >
              {group.label}
            </div>
          ))}
        </div>
      </div>
      {/* Detailed columns row */}
      <div className="flex" style={{ paddingLeft: `${nameColumnWidth}px` }}>
        <div className="relative" style={{ width: `${scale.totalWidth}px`, height: '24px' }}>
          {visibleColumns.map((col, i) => (
            <div
              key={col.startX}
              className={cn(
                'absolute top-0 h-full flex items-center justify-center border-r border-border/50 text-[10px]',
                zoomLevel === 'week' && col.date && checkToday(col.date) && 'bg-primary/10 font-bold text-primary',
                zoomLevel === 'week' && col.date && checkWeekend(col.date) && 'text-muted-foreground/50',
              )}
              style={{ left: `${col.startX}px`, width: `${col.width}px` }}
            >
              {col.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
