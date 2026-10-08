import { memo, useState, useEffect } from 'react';
import { User, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimelineBar } from './TimelineBar';
import { type TimelineScale } from './useTimelineScale';
import { type MemberData } from '@/lib/memberData';

interface MemberTimelineRowProps {
  member: MemberData;
  scale: TimelineScale;
  nameColumnWidth: number;
  onGoalClick: (goalId: string, subGoalId?: string) => void;
  isEven: boolean;
  showSubGoals?: boolean;
}

export const MemberTimelineRow = memo(function MemberTimelineRow({
  member,
  scale,
  nameColumnWidth,
  onGoalClick,
  isEven,
  showSubGoals,
}: MemberTimelineRowProps) {
  const goalsWithDates = member.goals.filter((g) => g.startDate && g.dueDate);
  const subGoalsWithDates = member.subGoals.filter((s) => s.startDate && s.dueDate);
  const hasSubGoals = member.subGoals.length > 0;

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (showSubGoals !== undefined) {
      setExpanded(showSubGoals);
    }
  }, [showSubGoals]);

  if (goalsWithDates.length === 0 && subGoalsWithDates.length === 0) return null;

  const rowHeight = 36;
  const visibleSubGoals = expanded ? subGoalsWithDates : [];
  const totalRows = goalsWithDates.length + visibleSubGoals.length;
  const totalHeight = Math.max(totalRows, 1) * rowHeight + 8;

  return (
    <div
      className={cn(
        'flex border-b border-border/50',
        isEven ? 'bg-muted' : 'bg-background',
      )}
      style={{ minHeight: `${totalHeight}px` }}
    >
      {/* Sticky name column */}
      <div
        className={cn("sticky left-0 z-10 flex items-start gap-1 px-2 py-2 border-r border-border shrink-0", isEven ? 'bg-muted' : 'bg-background')}
        style={{ width: `${nameColumnWidth}px`, minWidth: `${nameColumnWidth}px` }}
      >
        {hasSubGoals ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-0.5 p-0.5 rounded hover:bg-muted shrink-0"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-[18px] shrink-0" />
        )}
        <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{member.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {member.totalCount}개 · {member.avgProgress}%
          </p>
        </div>
      </div>

      {/* Timeline area */}
      <div className="relative flex-1" style={{ width: `${scale.totalWidth}px`, minWidth: `${scale.totalWidth}px`, contain: 'layout style paint' }}>
        {goalsWithDates.map((goal, i) => (
          <div
            key={goal.id}
            className="absolute left-0 right-0 flex items-center"
            style={{ top: `${i * rowHeight + 4}px`, height: `${rowHeight}px` }}
          >
            <TimelineBar
              title={goal.title}
              startDate={goal.startDate}
              dueDate={goal.dueDate}
              progress={goal.progress}
              dateToX={scale.dateToX}
              dayWidth={scale.dayWidth}
              completed={goal.completed}
              onHold={goal.onHold}
              onClick={() => onGoalClick(goal.id)}
            />
          </div>
        ))}
        {visibleSubGoals.map((sub, i) => (
          <div
            key={sub.id}
            className="absolute left-0 right-0 flex items-center"
            style={{ top: `${(goalsWithDates.length + i) * rowHeight + 4}px`, height: `${rowHeight}px` }}
          >
            <TimelineBar
              title={`↳ ${sub.title}`}
              startDate={sub.startDate}
              dueDate={sub.dueDate}
              progress={sub.progress}
              dateToX={scale.dateToX}
              dayWidth={scale.dayWidth}
              isSubGoal
              onClick={() => onGoalClick(sub.parentGoalId, sub.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
