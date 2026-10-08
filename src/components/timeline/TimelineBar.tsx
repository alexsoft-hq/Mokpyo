import { memo } from 'react';
import { cn } from '@/lib/utils';

interface TimelineBarProps {
  title: string;
  startDate?: string;
  dueDate?: string;
  progress: number;
  dateToX: (date: Date) => number;
  dayWidth: number;
  isSubGoal?: boolean;
  completed?: boolean;
  onHold?: boolean;
  onClick?: () => void;
}

function getBarColor(progress: number, completed?: boolean, onHold?: boolean) {
  if (onHold) return { bg: 'bg-muted', fill: 'bg-muted-foreground/40' };
  if (completed || progress >= 100) return { bg: 'bg-green-100 dark:bg-green-950', fill: 'bg-green-500 dark:bg-green-400' };
  if (progress >= 80) return { bg: 'bg-green-100 dark:bg-green-950', fill: 'bg-green-500 dark:bg-green-400' };
  if (progress >= 50) return { bg: 'bg-blue-100 dark:bg-blue-950', fill: 'bg-blue-500 dark:bg-blue-400' };
  if (progress >= 20) return { bg: 'bg-amber-100 dark:bg-amber-950', fill: 'bg-amber-500 dark:bg-amber-400' };
  return { bg: 'bg-gray-100 dark:bg-gray-800', fill: 'bg-gray-400 dark:bg-gray-500' };
}

// Simple date parser: "2026-04-03" -> Date (avoids date-fns parseISO overhead)
function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-');
  return new Date(+y, +m - 1, +d);
}

const formatDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
};

export const TimelineBar = memo(function TimelineBar({
  title,
  startDate,
  dueDate,
  progress,
  dateToX,
  dayWidth,
  isSubGoal = false,
  completed,
  onHold,
  onClick,
}: TimelineBarProps) {
  if (!startDate || !dueDate) return null;

  const start = parseDateStr(startDate);
  const end = parseDateStr(dueDate);
  const left = dateToX(start);
  const right = dateToX(end);
  const width = Math.max(right - left, dayWidth);
  const colors = getBarColor(progress, completed, onHold);
  const barHeight = isSubGoal ? 'h-5' : 'h-7';

  // Build tooltip text as title attribute (zero JS overhead, browser-native)
  const tooltipText = `${title}\n${formatDate(startDate)} ~ ${formatDate(dueDate)}\n진행률: ${progress}%${completed ? ' (완료)' : ''}${onHold ? ' (보류)' : ''}`;

  return (
    <div
      className={cn(
        'absolute rounded-md cursor-pointer hover:brightness-95 hover:shadow-sm',
        barHeight,
        colors.bg,
        onHold && 'opacity-60',
      )}
      style={{ left: `${left}px`, width: `${width}px`, contain: 'layout style paint' }}
      onClick={onClick}
      title={tooltipText}
    >
      {/* Progress fill */}
      <div
        className={cn('h-full rounded-md', colors.fill)}
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
      {/* Title label inside bar */}
      {width > 60 && (
        <span
          className={cn(
            'absolute inset-0 flex items-center px-2 text-xs font-medium truncate',
            progress > 50 ? 'text-white dark:text-white' : 'text-foreground',
          )}
        >
          {title}
        </span>
      )}
    </div>
  );
});
