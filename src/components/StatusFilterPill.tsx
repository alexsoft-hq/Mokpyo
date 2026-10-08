import { CheckCircle2, PauseCircle, UserCheck } from 'lucide-react';

interface StatusFilterPillProps {
  showCompleted: boolean;
  onShowCompletedToggle: () => void;
  completedCount: number;
  showOnHold: boolean;
  onShowOnHoldToggle: () => void;
  onHoldCount: number;
  showMineOnly?: boolean;
  onShowMineToggle?: () => void;
  mineCount?: number;
}

export const StatusFilterPill = ({
  showCompleted,
  onShowCompletedToggle,
  completedCount,
  showOnHold,
  onShowOnHoldToggle,
  onHoldCount,
  showMineOnly = false,
  onShowMineToggle,
  mineCount = 0,
}: StatusFilterPillProps) => {
  return (
    <div className="inline-flex items-center rounded-full border bg-background/50 shadow-sm overflow-hidden">
      {onShowMineToggle && (
        <>
          <button
            onClick={onShowMineToggle}
            aria-pressed={showMineOnly}
            title="내 목표만 보기"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              showMineOnly
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>내 목표{mineCount > 0 ? ` ${mineCount}` : ''}</span>
          </button>
          <div className="w-px h-5 bg-border" />
        </>
      )}
      <button
        onClick={onShowCompletedToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          showCompleted
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'text-muted-foreground hover:bg-muted/50'
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>{completedCount}</span>
      </button>
      <div className="w-px h-5 bg-border" />
      <button
        onClick={onShowOnHoldToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          showOnHold
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            : 'text-muted-foreground hover:bg-muted/50'
        }`}
      >
        <PauseCircle className="w-3.5 h-3.5" />
        <span>{onHoldCount}</span>
      </button>
    </div>
  );
};
