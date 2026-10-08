import { Goal, GoalCategory } from '@/types/goal';
import { Progress } from '@/components/ui/progress';
import { Plus, Minimize2, Maximize2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/FilterBar';
import { StatusFilterPill } from '@/components/StatusFilterPill';
import { CycleFilter } from '@/components/CycleFilter';
import { CategoryStatStrip } from '@/components/CategoryStatStrip';
import { Cycle } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OverallSummaryProps {
  goals: Goal[];
  filteredGoals: Goal[];
  onAddGoal: () => void;
  categoryColors?: Record<string, string>;
  viewMode?: 'normal' | 'compact';
  onViewModeChange?: (mode: 'normal' | 'compact') => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  selectedOwners: string[];
  onOwnerToggle: (owner: string) => void;
  selectedCategories: GoalCategory[];
  onCategoryToggle: (category: GoalCategory) => void;
  owners: string[];
  categories: GoalCategory[];
  showCompleted: boolean;
  onShowCompletedToggle: () => void;
  completedCount: number;
  showOnHold?: boolean;
  onShowOnHoldToggle?: () => void;
  onHoldCount?: number;
  showMineOnly?: boolean;
  onShowMineToggle?: () => void;
  mineCount?: number;
  onSettingsClick?: () => void;
  user?: { userId: string; email: string; name: string; picture?: string } | null;
  onLogout?: () => void;
  onUserUpdate?: (user: { userId: string; email: string; name: string; picture?: string }) => void;
  cycles?: Cycle[];
  selectedCycleId?: string;
  onCycleChange?: (id: string) => void;
  canManageCycles?: boolean;
  onCyclesChange?: () => void;
  onGoalsChange?: () => void;
}

export const OverallSummary = ({
  goals,
  filteredGoals,
  onAddGoal,
  categoryColors,
  viewMode = 'normal',
  onViewModeChange,
  searchText,
  onSearchChange,
  selectedOwners,
  onOwnerToggle,
  selectedCategories,
  onCategoryToggle,
  owners,
  categories,
  showCompleted,
  onShowCompletedToggle,
  completedCount,
  showOnHold = false,
  onShowOnHoldToggle,
  onHoldCount = 0,
  showMineOnly = false,
  onShowMineToggle,
  mineCount = 0,
  onSettingsClick,
  user,
  onLogout,
  onUserUpdate,
  cycles,
  selectedCycleId = '',
  onCycleChange,
  canManageCycles = false,
  onCyclesChange,
  onGoalsChange,
}: OverallSummaryProps) => {
  // Filter goals based on showCompleted toggle
  const displayGoals = goals.filter(g => (showCompleted || !g.completed) && (showOnHold || !g.onHold));

  const overallAverage = displayGoals.length > 0
    ? Math.round(displayGoals.reduce((sum, goal) => sum + goal.progress, 0) / displayGoals.length)
    : 0;

  const filteredAverage = filteredGoals.length > 0
    ? Math.round(
        filteredGoals.reduce((sum, goal) => sum + goal.progress, 0) / filteredGoals.length
      )
    : 0;

  // Calculate category statistics based on showCompleted toggle
  const categoryStats = displayGoals.reduce((acc, goal) => {
    // Handle multiple categories per goal
    if (goal.categories && goal.categories.length > 0) {
      goal.categories.forEach((category) => {
        if (!acc[category]) {
          acc[category] = { count: 0, totalProgress: 0 };
        }
        acc[category].count++;
        acc[category].totalProgress += goal.progress;
      });
    }
    return acc;
  }, {} as Record<string, { count: number; totalProgress: number }>);

  return (
    <div className="bg-card rounded-xl shadow-lg p-5 mb-6 border border-border">
      {/* 카드뷰 컨트롤(Tier-2). 공통 크롬(프로젝트·알림·워크스페이스·계정·바로가기)은 AppHeader 로 이동 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap justify-end">
          {cycles && onCycleChange && (
            <CycleFilter
              cycles={cycles}
              selectedCycleId={selectedCycleId}
              onCycleChange={onCycleChange}
              canManage={canManageCycles}
              onCyclesChange={onCyclesChange}
              onGoalsChange={onGoalsChange}
            />
          )}
          <StatusFilterPill
            showCompleted={showCompleted}
            onShowCompletedToggle={onShowCompletedToggle}
            completedCount={completedCount}
            showOnHold={showOnHold}
            onShowOnHoldToggle={onShowOnHoldToggle || (() => {})}
            onHoldCount={onHoldCount}
            showMineOnly={showMineOnly}
            onShowMineToggle={onShowMineToggle}
            mineCount={mineCount}
          />
          {onViewModeChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="default" variant="outline" className="whitespace-nowrap">
                  {viewMode === 'normal' && <><Maximize2 className="w-4 h-4 mr-2" />상세보기</>}
                  {viewMode === 'compact' && <><Minimize2 className="w-4 h-4 mr-2" />요약보기</>}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onViewModeChange('compact')}>
                  <Minimize2 className="w-4 h-4 mr-2" />
                  요약보기
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewModeChange('normal')}>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  상세보기
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={onAddGoal} size="default" className="shadow-lg whitespace-nowrap">
            <Plus className="w-4 h-4 mr-2" />
            새 목표 추가
          </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-muted-foreground mb-1">전체 평균 진행률</p>
              <p className="text-3xl font-bold text-primary">{overallAverage}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">총 목표</p>
              <p className="text-xl font-semibold">{goals.length}개</p>
            </div>
          </div>
          <Progress value={overallAverage} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-muted-foreground mb-1">필터된 목표 평균</p>
              <p className="text-3xl font-bold text-accent">{filteredAverage}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">필터된 목표</p>
              <p className="text-xl font-semibold">{filteredGoals.length}개</p>
            </div>
          </div>
          <Progress value={filteredAverage} className="h-2" />
        </div>
      </div>

      {/* 카테고리별 현황 — 전체폭 전용 스트립 (필터 겸용) */}
      {Object.keys(categoryStats).length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <CategoryStatStrip
            stats={categoryStats}
            categoryColors={categoryColors}
            selected={selectedCategories}
            onToggle={onCategoryToggle}
            density="comfortable"
          />
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border">
        <FilterBar
          searchText={searchText}
          onSearchChange={onSearchChange}
          selectedOwners={selectedOwners}
          onOwnerToggle={onOwnerToggle}
          owners={owners}
        />
      </div>
    </div>
  );
};
