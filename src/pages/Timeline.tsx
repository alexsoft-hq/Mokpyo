import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Goal, GoalCategory } from '@/types/goal';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { buildMemberData, getProgressColor } from '@/lib/memberData';
import { StatusFilterPill } from '@/components/StatusFilterPill';
import { EmptyState } from '@/components/common/EmptyState';
import { useSampleData } from '@/components/onboarding/useSampleData';

const GoalDetailModal = lazy(() => import('@/components/GoalDetailModal').then(m => ({ default: m.GoalDetailModal })));
import { type RegisteredUser } from '@/components/OwnerInput';
import { useTimelineScale, type ZoomLevel } from '@/components/timeline/useTimelineScale';
import { TimelineChart, type TimelineChartHandle } from '@/components/timeline/TimelineChart';
import { MemberTimelineRow } from '@/components/timeline/MemberTimelineRow';
import { GoalTimelineRow } from '@/components/timeline/GoalTimelineRow';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  ArrowLeft,
  Users,
  Target,
  Loader2,
  Search,
  X,
  Calendar,
  FileText,
  User,
  CheckCircle2,
  PauseCircle,
  StickyNote,
  Paperclip,
  AlertCircle,
  ChevronsUpDown,
  ChevronsDownUp,
  History,
} from 'lucide-react';

type ViewMode = 'member' | 'goal';

const MIN_COL_WIDTH = 150;
const MAX_COL_WIDTH = 500;
const DEFAULT_COL_WIDTH = 220;
const COL_WIDTH_STORAGE_KEY = 'timeline-name-col-width';

export default function Timeline() {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { loadSample, loading: sampleLoading } = useSampleData();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('goal');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [nameColWidth, setNameColWidth] = useState(() => {
    const stored = localStorage.getItem(COL_WIDTH_STORAGE_KEY);
    return stored ? Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Number(stored))) : DEFAULT_COL_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(COL_WIDTH_STORAGE_KEY, String(nameColWidth));
  }, [nameColWidth]);

  // Status filters
  const [showCompleted, setShowCompleted] = useState(false);
  const [showOnHold, setShowOnHold] = useState(false);
  const [showAllPeriod, setShowAllPeriod] = useState(false);

  // SubGoal expand toggle: undefined = individual, true = all expanded, false = all collapsed
  const [showSubGoals, setShowSubGoals] = useState<boolean | undefined>(undefined);

  // Side panel state
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const timelineChartRef = useRef<TimelineChartHandle>(null);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [categories, setCategories] = useState<GoalCategory[]>([]);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Compute date range for completed goals filter (±6 months from today)
  const completedDateRange = useMemo(() => {
    if (showAllPeriod || !showCompleted) return { from: undefined, to: undefined };
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
    const to = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
      to: `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`,
    };
  }, [showAllPeriod, showCompleted]);

  useEffect(() => {
    if (!currentProject?.id) return;
    setIsLoading(true);
    Promise.all([
      api.getGoals(currentProject.id, true, false, true, true, completedDateRange.from, completedDateRange.to),
      api.getCategories(currentProject.id).catch(() => []),
      api.getUsers().catch(() => [] as RegisteredUser[]),
    ])
      .then(([goalsData, categoriesData, usersData]) => {
        setGoals(goalsData);
        const categoryNames = categoriesData.map((c: any) => c.name);
        setCategories(categoryNames);
        const colors: Record<string, string> = {};
        categoriesData.forEach((c: any) => { if (c.color) colors[c.name] = c.color; });
        setCategoryColors(colors);
        setRegisteredUsers(usersData);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [currentProject?.id, completedDateRange.from, completedDateRange.to]);

  // Status filter counts
  const completedCount = useMemo(() => goals.filter((g) => g.completed).length, [goals]);
  const onHoldCount = useMemo(() => goals.filter((g) => g.onHold).length, [goals]);

  // Apply status filters
  const displayGoals = useMemo(() =>
    goals.filter((g) => (showCompleted || !g.completed) && (showOnHold || !g.onHold)),
    [goals, showCompleted, showOnHold]
  );

  const scale = useTimelineScale(displayGoals, zoomLevel);

  const members = useMemo(() => buildMemberData(displayGoals), [displayGoals]);

  // Filtering
  const keyword = searchQuery.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    if (!keyword) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(keyword) ||
        m.goals.some((g) => g.title.toLowerCase().includes(keyword)) ||
        m.subGoals.some((s) => s.title.toLowerCase().includes(keyword))
    );
  }, [members, keyword]);

  const filteredGoals = useMemo(() => {
    if (!keyword) return displayGoals;
    return displayGoals.filter(
      (g) =>
        g.title.toLowerCase().includes(keyword) ||
        (g.owners && g.owners.length > 0 ? g.owners : [g.owner]).some(o => o.toLowerCase().includes(keyword)) ||
        g.subGoals?.some((s) => s.title.toLowerCase().includes(keyword))
    );
  }, [displayGoals, keyword]);

  // Items without dates
  const noDateItems = useMemo(() => {
    const items: { goalId: string; goalTitle: string; subGoalId?: string; subGoalTitle?: string }[] = [];
    for (const goal of displayGoals) {
      if (!goal.startDate || !goal.dueDate) {
        items.push({ goalId: goal.id, goalTitle: goal.title });
      }
      if (goal.subGoals) {
        for (const sub of goal.subGoals) {
          if (!sub.startDate || !sub.dueDate) {
            items.push({ goalId: goal.id, goalTitle: goal.title, subGoalId: sub.id, subGoalTitle: sub.title });
          }
        }
      }
    }
    return items;
  }, [displayGoals]);
  const [showNoDateList, setShowNoDateList] = useState(false);

  const existingOwners = useMemo(() => {
    const ownerSet = new Set<string>();
    goals.forEach((goal) => {
      const go = goal.owners && goal.owners.length > 0 ? goal.owners : (goal.owner ? [goal.owner] : []);
      go.forEach(o => ownerSet.add(o));
      goal.subGoals?.forEach((sub) => {
        const so = sub.owners && sub.owners.length > 0 ? sub.owners : (sub.owner ? [sub.owner] : []);
        so.forEach(o => ownerSet.add(o));
      });
    });
    return Array.from(ownerSet).sort();
  }, [goals]);

  const handleEditGoal = useCallback(() => {
    setIsEditModalOpen(true);
  }, []);

  const refreshGoals = useCallback(async () => {
    if (!currentProject?.id) return;
    const refreshed = await api.getGoals(currentProject.id, true, false, true, true, completedDateRange.from, completedDateRange.to);
    setGoals(refreshed);
    return refreshed;
  }, [currentProject?.id, completedDateRange.from, completedDateRange.to]);

  const handleSaveGoal = useCallback(async (updatedGoal: Goal) => {
    if (!currentProject?.id) return;
    await api.updateGoal(updatedGoal.id, updatedGoal);
    // Refresh lightweight goals for timeline + full goal for side panel
    const [, fullGoal] = await Promise.all([
      refreshGoals(),
      api.getGoal(updatedGoal.id).catch(() => null),
    ]);
    if (fullGoal) setSelectedGoal(fullGoal);
  }, [currentProject?.id, refreshGoals]);

  const handleDeleteGoal = useCallback(async (goalId: string) => {
    if (!currentProject?.id) return;
    await api.deleteGoal(goalId);
    await refreshGoals();
    setSheetOpen(false);
    setSelectedGoal(null);
  }, [currentProject?.id, refreshGoals]);

  const handleOpenDetail = useCallback((goalId: string, subGoalId?: string) => {
    setSelectedGoalId(goalId);
    setHighlightItemId(subGoalId || goalId);
    setSheetOpen(true);
    // Show cached data instantly, then refresh from server
    const cached = goals.find(g => g.id === goalId);
    if (cached) {
      setSelectedGoal(cached);
      setIsLoadingDetail(false);
    } else {
      setIsLoadingDetail(true);
    }
    api.getGoal(goalId)
      .then(setSelectedGoal)
      .catch(err => console.error('Error loading goal detail:', err))
      .finally(() => setIsLoadingDetail(false));
  }, [goals]);

  const handleSheetClose = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setSelectedGoalId(null);
      setHighlightItemId(null);
      setSelectedGoal(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Tier-1 공통 크롬 + 뷰 탭 */}
      <AppHeader showTabs />

      {/* Tier-2 타임라인 전용 툴바 (AppHeader 가 sticky 이므로 여기선 sticky 미적용 — 두 sticky 바 겹침 방지) */}
      <div className="bg-background border-b">
        <div className="px-4 lg:px-6 py-2 flex items-center gap-3 flex-wrap">
          {/* Status filter */}
          <StatusFilterPill
            showCompleted={showCompleted}
            onShowCompletedToggle={() => setShowCompleted(!showCompleted)}
            completedCount={completedCount}
            showOnHold={showOnHold}
            onShowOnHoldToggle={() => setShowOnHold(!showOnHold)}
            onHoldCount={onHoldCount}
          />

          {/* Show all period toggle - only visible when showCompleted is on */}
          {showCompleted && (
            <Button
              variant={showAllPeriod ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowAllPeriod(!showAllPeriod)}
              className="h-7 px-2 text-xs"
              title={showAllPeriod ? '최근 6개월 완료 목표만 표시' : '전체 기간 완료 목표 표시'}
            >
              <History className="h-3.5 w-3.5 mr-1" />
              전체 기간
            </Button>
          )}

          {/* Search */}
          <div className="relative w-48 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'goal' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('goal')}
              className="text-xs h-7 px-3"
            >
              <Target className="h-3.5 w-3.5 mr-1" />
              목표별
            </Button>
            <Button
              variant={viewMode === 'member' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('member')}
              className="text-xs h-7 px-3"
            >
              <Users className="h-3.5 w-3.5 mr-1" />
              담당자별
            </Button>
          </div>

          {/* SubGoal expand/collapse */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubGoals(true)}
              className="h-7 px-2"
              title="하위목표 전체 펼치기"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubGoals(false)}
              className="h-7 px-2"
              title="하위목표 전체 접기"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Today button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => timelineChartRef.current?.scrollToToday()}
            className="h-7 px-2 text-xs"
            title="오늘 날짜로 이동"
          >
            <Calendar className="h-3.5 w-3.5 mr-1" />
            오늘
          </Button>

          {/* Zoom level toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={zoomLevel === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setZoomLevel('week')}
              className="text-xs h-7 px-2"
            >
              주
            </Button>
            <Button
              variant={zoomLevel === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setZoomLevel('month')}
              className="text-xs h-7 px-2"
            >
              월
            </Button>
            <Button
              variant={zoomLevel === 'quarter' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setZoomLevel('quarter')}
              className="text-xs h-7 px-2"
            >
              분기
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 lg:px-6 py-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && goals.length === 0 && (
          <EmptyState
            icon={Target}
            title="타임라인에 그릴 목표가 없습니다"
            description="시작일과 마감일이 있는 목표를 추가하면 기간이 막대로 나타납니다."
            primaryAction={{ label: '새 목표', onClick: () => navigate('/?new=1') }}
            secondaryAction={{ label: '샘플 데이터로 둘러보기', onClick: loadSample, loading: sampleLoading }}
          />
        )}

        {!isLoading && goals.length > 0 && (
          <>
            <TimelineChart
              ref={timelineChartRef}
              scale={scale}
              zoomLevel={zoomLevel}
              nameColumnWidth={nameColWidth}
              onNameColumnWidthChange={setNameColWidth}
            >
              {viewMode === 'member'
                ? filteredMembers.map((member, i) => (
                    <MemberTimelineRow
                      key={member.name}
                      member={member}
                      scale={scale}
                      nameColumnWidth={nameColWidth}
                      onGoalClick={handleOpenDetail}
                      isEven={i % 2 === 0}
                      showSubGoals={showSubGoals}
                    />
                  ))
                : filteredGoals.map((goal, i) => (
                    <GoalTimelineRow
                      key={goal.id}
                      goal={goal}
                      scale={scale}
                      nameColumnWidth={nameColWidth}
                      onGoalClick={handleOpenDetail}
                      isEven={i % 2 === 0}
                      showSubGoals={showSubGoals}
                    />
                  ))}
            </TimelineChart>

            {/* No-date items notice */}
            {noDateItems.length > 0 && (
              <div className="mt-4 rounded-lg bg-muted/50 border border-border">
                <button
                  onClick={() => setShowNoDateList(!showNoDateList)}
                  className="w-full p-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    날짜가 설정되지 않은 항목 <strong>{noDateItems.length}개</strong>는 타임라인에 표시되지 않습니다.
                  </span>
                  <span className="ml-auto text-xs">{showNoDateList ? '접기' : '펼치기'}</span>
                </button>
                {showNoDateList && (
                  <div className="border-t border-border px-3 py-2 space-y-1 max-h-60 overflow-y-auto">
                    {noDateItems.map((item, i) => (
                      <button
                        key={`${item.goalId}-${item.subGoalId || 'goal'}-${i}`}
                        onClick={() => handleOpenDetail(item.goalId, item.subGoalId)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm flex items-center gap-2 transition-colors"
                      >
                        {item.subGoalTitle ? (
                          <>
                            <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground truncate">{item.goalTitle}</span>
                            <span className="text-muted-foreground">›</span>
                            <span className="truncate">{item.subGoalTitle}</span>
                          </>
                        ) : (
                          <>
                            <Target className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{item.goalTitle}</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Goal Detail Side Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-[560px] z-50 bg-background border-l shadow-2xl transition-transform duration-300 ease-in-out overflow-y-auto',
          sheetOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-lg">목표 상세</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleEditGoal} disabled={isLoadingDetail || !selectedGoal}>
              <FileText className="h-4 w-4 mr-1" />
              편집
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleSheetClose(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="p-4">
          {isLoadingDetail && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoadingDetail && selectedGoal && (
            <GoalSheetContent
              goal={selectedGoal}
              highlightSubGoalId={highlightItemId}
              onEdit={handleEditGoal}
            />
          )}
        </div>
      </div>
      {/* Edit Modal - lazy loaded */}
      {isEditModalOpen && (
        <Suspense fallback={null}>
          <GoalDetailModal
            goal={selectedGoal}
            open={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
            }}
            onSave={handleSaveGoal}
            onDelete={handleDeleteGoal}
            categories={categories}
            categoryColors={categoryColors}
            registeredUsers={registeredUsers}
            existingOwners={existingOwners}
          />
        </Suspense>
      )}
    </div>
  );
}

// GoalSheetContent (same as MemberView)
function GoalSheetContent({
  goal,
  highlightSubGoalId,
  onEdit,
}: {
  goal: Goal;
  highlightSubGoalId?: string | null;
  onEdit: () => void;
}) {
  useEffect(() => {
    if (!highlightSubGoalId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-sheet-subgoal-id="${highlightSubGoalId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightSubGoalId]);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold leading-snug">{goal.title}</h3>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          <User className="h-3 w-3 mr-1" />
          {(goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner]).join(', ')}
        </Badge>
        {goal.completed && (
          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" /> 완료
          </Badge>
        )}
        {goal.onHold && (
          <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <PauseCircle className="h-3 w-3 mr-1" /> 보류
          </Badge>
        )}
        {goal.categories?.map((cat) => (
          <Badge key={cat} variant="secondary" className="text-xs">
            {cat}
          </Badge>
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">진행률</span>
          <span className={`font-semibold ${getProgressColor(goal.progress)}`}>{goal.progress}%</span>
        </div>
        <Progress value={goal.progress} className="h-2" />
      </div>

      {(goal.startDate || goal.dueDate) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          {goal.startDate && <span>{goal.startDate}</span>}
          {goal.startDate && goal.dueDate && <span>~</span>}
          {goal.dueDate && <span>{goal.dueDate}</span>}
        </div>
      )}

      {goal.description && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <FileText className="h-4 w-4" /> 설명
          </h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words bg-muted/30 rounded-md p-3">
            {goal.description}
          </p>
        </div>
      )}

      {goal.statusNote && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">상태 메모</h4>
          <div className="text-sm text-muted-foreground italic whitespace-pre-wrap break-words bg-muted/30 rounded-md p-3 border-l-2 border-primary/30">
            {goal.statusNote}
          </div>
        </div>
      )}

      {goal.subGoals && goal.subGoals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <Target className="h-4 w-4" /> 하위목표 ({goal.subGoals.length})
          </h4>
          <div className="space-y-2">
            {goal.subGoals.map((sub) => {
              const isSubHighlighted = highlightSubGoalId === sub.id;
              return (
                <div
                  key={sub.id}
                  data-sheet-subgoal-id={sub.id}
                  className={cn(
                    'rounded-md p-3 space-y-1.5 transition-all',
                    isSubHighlighted
                      ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500 shadow-md'
                      : 'bg-muted/30'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${sub.progress === 100 ? 'line-through text-muted-foreground' : ''}`}>
                      {sub.title}
                    </span>
                    <span className={`text-xs font-medium ${getProgressColor(sub.progress)}`}>{sub.progress}%</span>
                  </div>
                  <Progress value={sub.progress} className="h-1.5" />
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {(sub.owners && sub.owners.length > 0 ? sub.owners : [sub.owner]).join(', ')}</span>
                    {(sub.startDate || sub.dueDate) && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {sub.startDate && sub.startDate}
                        {sub.startDate && sub.dueDate && ' ~ '}
                        {sub.dueDate && sub.dueDate}
                      </span>
                    )}
                  </div>
                  {sub.description && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{sub.description}</p>
                  )}
                  {sub.statusNote && (
                    <p className="text-xs text-muted-foreground italic whitespace-pre-wrap break-words border-l-2 border-primary/20 pl-2">{sub.statusNote}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {goal.notes && goal.notes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <StickyNote className="h-4 w-4" /> 메모 ({goal.notes.length})
          </h4>
          <div className="space-y-2">
            {goal.notes.map((note) => (
              <div key={note.id} className="bg-muted/30 rounded-md p-3 text-sm">
                <p className="whitespace-pre-wrap break-words">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(note.createdAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {goal.attachments && goal.attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <Paperclip className="h-4 w-4" /> 첨부파일 ({goal.attachments.length})
          </h4>
          <div className="space-y-1">
            {goal.attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate">{att.originalName}</span>
                <span className="text-xs shrink-0">({(att.size / 1024).toFixed(1)}KB)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t">
        <Button variant="default" size="sm" className="w-full" onClick={onEdit}>
          <FileText className="h-4 w-4 mr-2" />
          편집
        </Button>
      </div>
    </div>
  );
}
