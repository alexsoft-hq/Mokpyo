import { t, useTranslation } from '@/i18n';
import { useState } from 'react';
import { Goal, GoalCategory } from '@/types/goal';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Plus, Maximize2, Minimize2, ChevronDown, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

interface CompactOverallSummaryProps {
  goals: Goal[];
  onAddGoal: () => void;
  viewMode?: 'normal' | 'compact';
  onViewModeChange?: (mode: 'normal' | 'compact') => void;
  categoryColors?: Record<string, string>;
  selectedCategories: GoalCategory[];
  onCategoryToggle: (category: GoalCategory) => void;
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
  searchText: string;
  onSearchChange: (text: string) => void;
  selectedOwners: string[];
  onOwnerToggle: (owner: string) => void;
  owners: string[];
  cycles?: Cycle[];
  selectedCycleId?: string;
  onCycleChange?: (id: string) => void;
  canManageCycles?: boolean;
  onCyclesChange?: () => void;
  onGoalsChange?: () => void;
}

export const CompactOverallSummary = ({
  goals,
  onAddGoal,
  viewMode = 'compact',
  onViewModeChange,
  categoryColors,
  selectedCategories,
  onCategoryToggle,
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
  searchText,
  onSearchChange,
  selectedOwners,
  onOwnerToggle,
  owners,
  cycles,
  selectedCycleId = '',
  onCycleChange,
  canManageCycles = false,
  onCyclesChange,
  onGoalsChange,
}: CompactOverallSummaryProps) => {
  useTranslation();
  const [showFilters, setShowFilters] = useState(false);

  // Filter goals based on showCompleted toggle
  const displayGoals = goals.filter(g => (showCompleted || !g.completed) && (showOnHold || !g.onHold));

  const overallAverage = displayGoals.length > 0
    ? Math.round(displayGoals.reduce((sum, goal) => sum + goal.progress, 0) / displayGoals.length)
    : 0;

  // Calculate category statistics based on showCompleted toggle
  const categoryStats = displayGoals.reduce((acc, goal) => {
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

  const hasActiveFilters = searchText.length > 0 || selectedOwners.length > 0;

  return (
    <div className="bg-card rounded-lg shadow-md p-4 mb-4 border border-border">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {/* Left: 카드뷰 요약 통계(Tier-2). 공통 크롬은 AppHeader 로 이동 */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary whitespace-nowrap">
              {t("전체 평균:")} {overallAverage}%
            </span>
          </div>
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {t("총 {{count}}개 목표", { count: displayGoals.length })}
          </div>
        </div>

        {/* 가운데 스페이서 — 카테고리는 아래 전용 스트립으로 이동 */}
        <div className="flex-1" />

        {/* Right: Fixed width - Action buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto min-w-0 justify-start sm:justify-end">
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
          <Button
            size="sm"
            variant={showFilters || hasActiveFilters ? 'default' : 'outline'}
            className="shadow-sm"
            onClick={() => setShowFilters(!showFilters)}
            title={t("필터")}
          >
            <Filter className="w-4 h-4" />
            {hasActiveFilters && (
              <span className="ml-1 text-xs">
                {selectedOwners.length > 0 ? `${selectedOwners.length}` : ''}
              </span>
            )}
          </Button>
          {onViewModeChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="default" variant="outline" className="whitespace-nowrap">
                  {viewMode === 'normal' && <><Maximize2 className="w-4 h-4 mr-2" />{t("상세보기")}</>}
                  {viewMode === 'compact' && <><Minimize2 className="w-4 h-4 mr-2" />{t("요약보기")}</>}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onViewModeChange('compact')}>
                  <Minimize2 className="w-4 h-4 mr-2" />
                  {t("요약보기")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewModeChange('normal')}>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  {t("상세보기")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={onAddGoal} size="sm" className="shadow-md whitespace-nowrap">
            <Plus className="w-4 h-4 mr-2" />
            {t("새 목표")}
          </Button>
        </div>
      </div>

      <Progress value={overallAverage} className="h-1.5" />

      {/* 카테고리별 현황 — 전체폭 전용 스트립 (필터 겸용) */}
      {Object.keys(categoryStats).length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <CategoryStatStrip
            stats={categoryStats}
            categoryColors={categoryColors}
            selected={selectedCategories}
            onToggle={onCategoryToggle}
            density="compact"
          />
        </div>
      )}

      {/* Expandable filter row */}
      {showFilters && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("목표 검색...")}
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-40 h-9 justify-between font-normal bg-background hover:bg-accent hover:text-accent-foreground"
              >
                <span className="text-sm truncate">
                  {selectedOwners.length === 0
                    ? t("담당자 선택")
                    : t("{{value0}}명 선택", { value0: selectedOwners.length })}
                </span>
                <ChevronDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
              {owners.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {t("담당자가 없습니다")}
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2 pb-2 border-b">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => owners.forEach(owner => {
                        if (!selectedOwners.includes(owner)) {
                          onOwnerToggle(owner);
                        }
                      })}
                    >
                      {t("전체 선택")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => {
                        selectedOwners.forEach(owner => onOwnerToggle(owner));
                      }}
                    >
                      {t("전체 해제")}
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {owners.map((owner) => (
                      <div
                        key={owner}
                        className="flex items-center space-x-3 px-2 py-1.5 rounded-md hover:bg-accent/20 cursor-pointer transition-colors"
                        onClick={() => onOwnerToggle(owner)}
                      >
                        <Checkbox
                          id={`compact-owner-${owner}`}
                          checked={selectedOwners.includes(owner)}
                          className="pointer-events-none"
                        />
                        <label
                          htmlFor={`compact-owner-${owner}`}
                          className="text-sm leading-none cursor-pointer flex-1 select-none"
                        >
                          {owner}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
};
