import { memo, useState, useEffect } from 'react';
import { Target, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimelineBar } from './TimelineBar';
import { type TimelineScale } from './useTimelineScale';
import { Goal } from '@/types/goal';

interface GoalTimelineRowProps {
  goal: Goal;
  scale: TimelineScale;
  nameColumnWidth: number;
  onGoalClick: (goalId: string, subGoalId?: string) => void;
  isEven: boolean;
  showSubGoals?: boolean;
}

export const GoalTimelineRow = memo(function GoalTimelineRow({
  goal,
  scale,
  nameColumnWidth,
  onGoalClick,
  isEven,
  showSubGoals,
}: GoalTimelineRowProps) {
  const hasGoalDates = goal.startDate && goal.dueDate;
  const allSubGoals = goal.subGoals || [];
  const subGoalsWithDates = allSubGoals.filter((s) => s.startDate && s.dueDate);
  const hasSubGoals = allSubGoals.length > 0;

  const [expanded, setExpanded] = useState(false);

  // Sync with global toggle
  useEffect(() => {
    if (showSubGoals !== undefined) {
      setExpanded(showSubGoals);
    }
  }, [showSubGoals]);

  // If goal has no dates and no subgoals with dates, skip
  if (!hasGoalDates && subGoalsWithDates.length === 0) return null;

  const rowHeight = 36;
  const visibleSubGoals = expanded ? subGoalsWithDates : [];
  const goalRowCount = hasGoalDates ? 1 : 0;
  const totalRows = goalRowCount + visibleSubGoals.length;
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
        {/* Expand/collapse toggle */}
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
        <Target className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{goal.title}</p>
          <p className="text-[10px] text-muted-foreground">
            {(goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner]).join(', ')} · {goal.progress}%
            {hasSubGoals && ` · 하위 ${allSubGoals.length}개`}
          </p>
        </div>
      </div>

      {/* Timeline area */}
      <div className="relative flex-1" style={{ width: `${scale.totalWidth}px`, minWidth: `${scale.totalWidth}px`, contain: 'layout style paint' }}>
        {/* Parent goal bar */}
        {hasGoalDates && (
          <div
            className="absolute left-0 right-0 flex items-center"
            style={{ top: '4px', height: `${rowHeight}px` }}
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
        )}

        {/* Subgoal bars (only when expanded) */}
        {visibleSubGoals.map((sub, i) => (
          <div
            key={sub.id}
            className="absolute left-0 right-0 flex items-center"
            style={{
              top: `${(goalRowCount + i) * rowHeight + 4}px`,
              height: `${rowHeight}px`,
            }}
          >
            <TimelineBar
              title={`↳ ${sub.title}`}
              startDate={sub.startDate}
              dueDate={sub.dueDate}
              progress={sub.progress}
              dateToX={scale.dateToX}
              dayWidth={scale.dayWidth}
              isSubGoal
              onClick={() => onGoalClick(goal.id, sub.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
