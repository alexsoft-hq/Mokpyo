import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle, ReactNode } from 'react';
import { TimelineHeader } from './TimelineHeader';
import { type TimelineScale, type ZoomLevel } from './useTimelineScale';

export interface TimelineChartHandle {
  scrollToToday: () => void;
}

interface TimelineChartProps {
  scale: TimelineScale;
  zoomLevel: ZoomLevel;
  nameColumnWidth: number;
  onNameColumnWidthChange?: (width: number) => void;
  children: ReactNode;
}

const MIN_COL_WIDTH = 150;
const MAX_COL_WIDTH = 500;

const MS_PER_DAY = 86400000;

export const TimelineChart = forwardRef<TimelineChartHandle, TimelineChartProps>(
  function TimelineChart({ scale, zoomLevel, nameColumnWidth, onNameColumnWidthChange, children }, ref) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasScrolledRef = useRef(false);
    // Remember the center date of the viewport for zoom-level changes
    const centerDateRef = useRef<Date | null>(null);
    const prevZoomRef = useRef<ZoomLevel>(zoomLevel);
    // Visible X range for column virtualization
    const [visibleRange, setVisibleRange] = useState<{ left: number; right: number }>({ left: 0, right: 2000 });
    const today = new Date();
    const todayX = scale.dateToX(today);
    const todayInRange = today >= scale.startDate && today <= scale.endDate;

    // Compute the date at the center of the current viewport
    const getViewportCenterDate = useCallback((): Date | null => {
      const el = scrollRef.current;
      if (!el) return null;
      const centerX = el.scrollLeft - nameColumnWidth + el.clientWidth / 2;
      const dayOffset = centerX / scale.dayWidth;
      return new Date(scale.startDate.getTime() + dayOffset * MS_PER_DAY);
    }, [scale.startDate, scale.dayWidth, nameColumnWidth]);

    const scrollToToday = useCallback(() => {
      const el = scrollRef.current;
      if (!el || !todayInRange) return;
      const targetX = nameColumnWidth + todayX - el.clientWidth / 2;
      el.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
    }, [todayX, todayInRange, nameColumnWidth]);

    useImperativeHandle(ref, () => ({ scrollToToday }), [scrollToToday]);

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = nameColumnWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const newWidth = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, startWidth + moveEvent.clientX - startX));
        onNameColumnWidthChange?.(newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }, [nameColumnWidth, onNameColumnWidthChange]);

    // Capture center date before zoom level changes
    useEffect(() => {
      if (prevZoomRef.current !== zoomLevel) {
        prevZoomRef.current = zoomLevel;
      }
    }, [zoomLevel]);

    // On zoom change: restore scroll to the previously-centered date
    useEffect(() => {
      if (!hasScrolledRef.current) return;
      const targetDate = centerDateRef.current;
      if (!targetDate) return;

      const el = scrollRef.current;
      if (!el) return;

      const targetX = nameColumnWidth + scale.dateToX(targetDate) - el.clientWidth / 2;
      el.scrollLeft = Math.max(0, targetX);
      centerDateRef.current = null;
    }, [scale, nameColumnWidth]);

    // Unified scroll handler: capture center date + update visible range
    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      let ticking = false;
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(() => {
            centerDateRef.current = getViewportCenterDate();
            // Update visible range with overscan buffer
            const overscan = el.clientWidth;
            const left = Math.max(0, el.scrollLeft - nameColumnWidth - overscan);
            const right = el.scrollLeft - nameColumnWidth + el.clientWidth + overscan;
            setVisibleRange({ left, right });
            ticking = false;
          });
        }
      };
      el.addEventListener('scroll', onScroll, { passive: true });
      // Initial range calculation
      onScroll();
      return () => el.removeEventListener('scroll', onScroll);
    }, [getViewportCenterDate, nameColumnWidth]);

    // Auto-scroll to today on first render
    useEffect(() => {
      if (hasScrolledRef.current) return;
      const el = scrollRef.current;
      if (!el || !todayInRange) return;
      const targetX = nameColumnWidth + todayX - el.clientWidth / 2;
      el.scrollLeft = Math.max(0, targetX);
      hasScrolledRef.current = true;
    }, [todayX, todayInRange, nameColumnWidth]);

    return (
      <div className="relative">
        {/* Column resize handle - outside scroll container so it stays fixed */}
        {onNameColumnWidthChange && (
          <div
            className="absolute top-0 bottom-0 z-30 cursor-col-resize group"
            style={{ left: `${nameColumnWidth - 2}px`, width: '5px' }}
            onMouseDown={handleResizeStart}
          >
            <div className="w-px h-full mx-auto bg-transparent group-hover:bg-primary/40 transition-colors" />
          </div>
        )}
        <div
          ref={scrollRef}
          className="relative overflow-auto border border-border rounded-lg bg-background"
          style={{ maxHeight: 'calc(100vh - 220px)' }}
        >
          <div style={{ minWidth: `${nameColumnWidth + scale.totalWidth}px` }}>
          {/* Header */}
          <TimelineHeader
            scale={scale}
            zoomLevel={zoomLevel}
            nameColumnWidth={nameColumnWidth}
            visibleRange={visibleRange}
          />

          {/* Rows */}
          <div className="relative">
            {/* Today marker */}
            {todayInRange && (
              <div
                className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-red-400 dark:border-red-500 z-10 pointer-events-none"
                style={{ left: `${nameColumnWidth + todayX}px` }}
              />
            )}
            {children}
          </div>
          </div>
        </div>
      </div>
    );
  }
);
