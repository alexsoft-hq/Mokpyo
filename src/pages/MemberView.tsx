import { useTranslation, t, getLocale } from '@/i18n';
import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Goal, SubGoal, GoalCategory } from '@/types/goal';

const GoalDetailModal = lazy(() => import('@/components/GoalDetailModal').then(m => ({ default: m.GoalDetailModal })));
import { type RegisteredUser } from '@/components/OwnerInput';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { buildMemberData, getProgressColor, type MemberData, type GoalWithRole, type SubGoalWithParent } from '@/lib/memberData';
import {
  ArrowLeft,
  LayoutGrid,
  LayoutDashboard,
  List,
  ChevronDown,
  ChevronRight,
  Loader2,
  User,
  Target,
  CheckCircle2,
  PauseCircle,
  Clock,
  Search,
  X,
  ChevronsDownUp,
  ChevronsUpDown,
  Calendar,
  FileText,
  ExternalLink,
  Paperclip,
  StickyNote,
} from 'lucide-react';
import { MemberDashboard } from '@/components/member/MemberDashboard';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';


export default function MemberView() {
  useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentProject } = useProject();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'dashboard' | 'card' | 'list'>('dashboard');
  const [memberSearch, setMemberSearch] = useState(() => searchParams.get('owner') ?? '');
  const [goalSearch, setGoalSearch] = useState('');
  const [expandAll, setExpandAll] = useState<boolean | null>(null); // null = individual control
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [categories, setCategories] = useState<GoalCategory[]>([]);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);

  useEffect(() => {
    if (!currentProject?.id) return;
    setIsLoading(true);
    Promise.all([
      api.getGoals(currentProject.id, true, false, true, true),
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
  }, [currentProject?.id]);

  // Note: highlight + scroll is handled inside GoalSheetContent via highlightSubGoalId prop

  const members = useMemo(() => buildMemberData(goals), [goals]);

  const filteredMembers = useMemo(() => {
    const memberKeyword = memberSearch.trim().toLowerCase();
    const goalKeyword = goalSearch.trim().toLowerCase();

    let result = members;

    // Filter by member name
    if (memberKeyword) {
      result = result.filter((m) => m.name.toLowerCase().includes(memberKeyword));
    }

    // Filter by goal/subgoal title — keep only matching items within each member
    if (goalKeyword) {
      result = result
        .map((m) => {
          const matchedGoals = m.goals.filter((g) =>
            g.title.toLowerCase().includes(goalKeyword)
          );
          const matchedSubGoals = m.subGoals.filter((s) =>
            s.title.toLowerCase().includes(goalKeyword)
          );
          if (matchedGoals.length === 0 && matchedSubGoals.length === 0) return null;

          const allItems = [
            ...matchedGoals.map((g) => ({ progress: g.progress, completed: g.completed, onHold: g.onHold })),
            ...matchedSubGoals.map((s) => ({ progress: s.progress, completed: s.progress === 100, onHold: false })),
          ];

          return {
            ...m,
            goals: matchedGoals,
            subGoals: matchedSubGoals,
            totalCount: allItems.length,
            completedCount: allItems.filter((i) => i.completed).length,
            onHoldCount: matchedGoals.filter((g) => g.onHold).length,
            avgProgress: allItems.length > 0
              ? Math.round(allItems.reduce((sum, i) => sum + i.progress, 0) / allItems.length)
              : 0,
          } as MemberData;
        })
        .filter(Boolean) as MemberData[];
    }

    return result;
  }, [members, memberSearch, goalSearch]);

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
    const refreshed = await api.getGoals(currentProject.id, true, false, true, true);
    setGoals(refreshed);
    return refreshed;
  }, [currentProject?.id]);

  const handleSaveGoal = useCallback(async (updatedGoal: Goal) => {
    if (!currentProject?.id) return;
    await api.updateGoal(updatedGoal.id, updatedGoal);
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

  const handleOpenDetail = useCallback((goalId: string, itemId?: string) => {
    setSelectedGoalId(goalId);
    setHighlightItemId(itemId || goalId);
    setSheetOpen(true);
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

  const hasActiveFilter = memberSearch.trim() !== '' || goalSearch.trim() !== '';

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={t("담당자별 현황")}
        subtitle={currentProject ? t("{{value0}} · {{value1}}명", { value0: currentProject.name, value1: members.length }) : undefined}
        backTo="/dashboard"
        showProjectSelector={false}
        actions={
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button variant={viewMode === 'dashboard' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('dashboard')} title={t("대시보드")}>
              <LayoutDashboard className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'card' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('card')} title={t("카드뷰")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} title={t("목록뷰")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Search Filters */}
      {!isLoading && members.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("담당자 검색...")}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9 pr-8"
              />
              {memberSearch && (
                <button onClick={() => setMemberSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="relative flex-1">
              <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("목표/하위목표 검색...")}
                value={goalSearch}
                onChange={(e) => setGoalSearch(e.target.value)}
                className="pl-9 pr-8"
              />
              {goalSearch && (
                <button onClick={() => setGoalSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setExpandAll(true)}
                title={t("전체 펼치기")}
              >
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setExpandAll(false)}
                title={t("전체 접기")}
              >
                <ChevronsDownUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {hasActiveFilter && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("{{shown}}명 표시 (전체 {{total}}명)", { shown: filteredMembers.length, total: members.length })}</p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && members.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">{t("담당자가 없습니다.")}</div>
        )}

        {!isLoading && filteredMembers.length === 0 && members.length > 0 && (
          <div className="text-center py-12 text-muted-foreground">{t("검색 결과가 없습니다.")}</div>
        )}

        {!isLoading && filteredMembers.length > 0 && viewMode === 'dashboard' && (
          <MemberDashboard members={filteredMembers} onOpenDetail={handleOpenDetail} />
        )}

        {!isLoading && filteredMembers.length > 0 && viewMode === 'card' && (
          <CardView members={filteredMembers} onOpenDetail={handleOpenDetail} highlightItemId={highlightItemId} expandAll={expandAll} onExpandApplied={() => setExpandAll(null)} />
        )}

        {!isLoading && filteredMembers.length > 0 && viewMode === 'list' && (
          <ListView members={filteredMembers} onOpenDetail={handleOpenDetail} highlightItemId={highlightItemId} expandAll={expandAll} onExpandApplied={() => setExpandAll(null)} />
        )}
      </div>

      {/* Goal Detail Side Panel (no overlay) */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-[560px] z-50 bg-background border-l shadow-2xl transition-transform duration-300 ease-in-out overflow-y-auto',
          sheetOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-lg">{t("목표 상세")}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleEditGoal} disabled={isLoadingDetail || !selectedGoal}>
              <FileText className="h-4 w-4 mr-1" />{t("편집")}</Button>
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
            <GoalSheetContent goal={selectedGoal} highlightSubGoalId={highlightItemId} onEdit={handleEditGoal} />
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

// ============================================================
// Card View
// ============================================================

function CardView({
  members,
  onOpenDetail,
  highlightItemId,
  expandAll,
  onExpandApplied,
}: {
  members: MemberData[];
  onOpenDetail: (goalId: string, itemId?: string) => void;
  highlightItemId: string | null;
  expandAll: boolean | null;
  onExpandApplied: () => void;
}) {
  useTranslation();
  useEffect(() => {
    if (expandAll !== null) onExpandApplied();
  }, [expandAll]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {members.map((member) => (
        <MemberCard key={member.name} member={member} onOpenDetail={onOpenDetail} highlightItemId={highlightItemId} expandAll={expandAll} />
      ))}
    </div>
  );
}

function MemberCard({
  member,
  onOpenDetail,
  highlightItemId,
  expandAll,
}: {
  member: MemberData;
  onOpenDetail: (goalId: string, itemId?: string) => void;
  highlightItemId: string | null;
  expandAll: boolean | null;
}) {
  useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (expandAll !== null) setIsOpen(expandAll);
  }, [expandAll]);

  return (
    <div className="bg-card rounded-lg border p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{member.name}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              {t('목표 {{count}}건', { count: member.totalCount })}</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {member.completedCount}
            </span>
            {member.onHoldCount > 0 && (
              <span className="flex items-center gap-1">
                <PauseCircle className="h-3 w-3 text-yellow-500" />
                {member.onHoldCount}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className={`text-lg font-bold ${getProgressColor(member.avgProgress)}`}>
            {member.avgProgress}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <Progress value={member.avgProgress} className="h-2 mb-3" />

      {/* Goals Accordion */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
            <span>{t("목표 {{goals}}건 · 하위목표 {{subgoals}}건", { goals: member.goals.length, subgoals: member.subGoals.length })}</span>
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-1">
            {member.goals.map((goal) => (
              <GoalItem key={goal.id} goal={goal} onOpenDetail={onOpenDetail} highlightItemId={highlightItemId} />
            ))}
            {member.subGoals.length > 0 && member.goals.length > 0 && (
              <div className="border-t my-2" />
            )}
            {member.subGoals.map((sub) => (
              <SubGoalItem key={sub.id} subGoal={sub} onOpenDetail={onOpenDetail} highlightItemId={highlightItemId} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================
// List View
// ============================================================

function ListView({
  members,
  onOpenDetail,
  highlightItemId,
  expandAll,
  onExpandApplied,
}: {
  members: MemberData[];
  onOpenDetail: (goalId: string, itemId?: string) => void;
  highlightItemId: string | null;
  expandAll: boolean | null;
  onExpandApplied: () => void;
}) {
  useTranslation();
  useEffect(() => {
    if (expandAll !== null) onExpandApplied();
  }, [expandAll]);

  return (
    <div className="space-y-4">
      {members.map((member) => (
        <MemberListSection key={member.name} member={member} onOpenDetail={onOpenDetail} highlightItemId={highlightItemId} expandAll={expandAll} />
      ))}
    </div>
  );
}

function MemberListSection({
  member,
  onOpenDetail,
  highlightItemId,
  expandAll,
}: {
  member: MemberData;
  onOpenDetail: (goalId: string, itemId?: string) => void;
  highlightItemId: string | null;
  expandAll: boolean | null;
}) {
  useTranslation();
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (expandAll !== null) setIsOpen(expandAll);
  }, [expandAll]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {/* Section Header */}
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold flex-1">{member.name}</span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {t('목표 {{count}}건', { count: member.totalCount })}</span>
            <div className="flex items-center gap-2 w-32">
              <Progress value={member.avgProgress} className="h-2 flex-1" />
              <span className={`text-sm font-medium w-10 text-right ${getProgressColor(member.avgProgress)}`}>
                {member.avgProgress}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {member.completedCount}
              </Badge>
              {member.onHoldCount > 0 && (
                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  <PauseCircle className="h-3 w-3 mr-1" />
                  {member.onHoldCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CollapsibleTrigger>

      {/* Goals & SubGoals */}
      <CollapsibleContent>
        <div className="ml-4 border-l-2 border-muted pl-4 mt-1 space-y-1">
          {member.goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} onOpenDetail={onOpenDetail} highlightItemId={highlightItemId} />
          ))}
          {member.subGoals.length > 0 && member.goals.length > 0 && (
            <div className="border-t my-2" />
          )}
          {member.subGoals.map((sub) => (
            <SubGoalRow key={sub.id} subGoal={sub} onOpenDetail={onOpenDetail} highlightItemId={highlightItemId} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================
// Shared Detail Panel
// ============================================================

function GoalDetailPanel({
  title,
  description,
  progress,
  startDate,
  dueDate,
  statusNote,
  completed,
  onHold,
  subGoals,
  parentGoalTitle,
  onOpenDetail,
  goalId,
  itemId,
}: {
  title: string;
  description?: string;
  progress: number;
  startDate?: string;
  dueDate?: string;
  statusNote?: string;
  completed?: boolean;
  onHold?: boolean;
  subGoals?: SubGoal[];
  parentGoalTitle?: string;
  onOpenDetail: (goalId: string, itemId?: string) => void;
  goalId: string;
  itemId: string;
}) {
  useTranslation();
  return (
    <div className="mt-1 mb-1 mx-1 p-3 bg-muted/30 border rounded-md text-xs space-y-2">
      {/* Status badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {completed && (
          <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />{t("완료")}</Badge>
        )}
        {onHold && (
          <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <PauseCircle className="h-3 w-3 mr-1" />{t("보류")}</Badge>
        )}
        {parentGoalTitle && (
          <Badge variant="outline" className="text-[10px]">{t("상위:")}{parentGoalTitle}
          </Badge>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-12 shrink-0">{t("진행률")}</span>
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className={`font-medium w-8 text-right ${getProgressColor(progress)}`}>{progress}%</span>
      </div>

      {/* Dates */}
      {(startDate || dueDate) && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          {startDate && <span>{startDate}</span>}
          {startDate && dueDate && <span>~</span>}
          {dueDate && <span>{dueDate}</span>}
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="flex gap-2">
          <FileText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-muted-foreground whitespace-pre-wrap break-words">{description}</p>
        </div>
      )}

      {/* Status Note */}
      {statusNote && (
        <div className="px-2 py-1.5 bg-background border rounded text-muted-foreground italic whitespace-pre-wrap break-words">
          {statusNote}
        </div>
      )}

      {/* Sub-goals of this goal (card view) */}
      {subGoals && subGoals.length > 0 && (
        <div className="space-y-1 pt-1 border-t">
          <span className="text-muted-foreground font-medium">{t("하위목표 (")}{subGoals.length})</span>
          {subGoals.map((sub) => (
            <div key={sub.id} className="pl-2 space-y-0.5">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className={`flex-1 truncate ${sub.progress === 100 ? 'line-through text-muted-foreground' : ''}`}>
                  {sub.title}
                </span>
                <span className="text-muted-foreground">{(sub.owners && sub.owners.length > 0 ? sub.owners : [sub.owner]).join(', ')}</span>
                <span className={`font-medium ${getProgressColor(sub.progress)}`}>{sub.progress}%</span>
              </div>
              {(sub.startDate || sub.dueDate) && (
                <div className="flex items-center gap-1 pl-5 text-[10px] text-muted-foreground">
                  <Calendar className="h-2.5 w-2.5" />
                  {sub.startDate && sub.startDate}
                  {sub.startDate && sub.dueDate && ' ~ '}
                  {sub.dueDate && sub.dueDate}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Open detail side panel */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenDetail(goalId, itemId); }}
        className="flex items-center gap-1 text-primary hover:underline pt-1"
      >
        <ExternalLink className="h-3 w-3" />{t("목표 상세 보기")}</button>
    </div>
  );
}

// ============================================================
// Card View Item Components
// ============================================================

function GoalItem({
  goal,
  onOpenDetail,
  highlightItemId,
}: {
  goal: GoalWithRole;
  onOpenDetail: (goalId: string, itemId?: string) => void;
  highlightItemId: string | null;
}) {
  useTranslation();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  return (
    <div data-highlight-id={goal.id}>
      <button
        onClick={() => setIsDetailOpen(!isDetailOpen)}
        className="w-full text-left px-2 py-1.5 rounded transition-all flex items-center gap-2 hover:bg-muted/50"
      >
        {isDetailOpen ? <ChevronDown className="h-3 w-3 text-primary flex-shrink-0" /> : <Target className="h-3 w-3 text-primary flex-shrink-0" />}
        <span className={`text-sm flex-1 truncate ${goal.completed ? 'line-through text-muted-foreground' : ''} ${goal.onHold ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
          {goal.title}
        </span>
        <span className={`text-xs font-medium ${getProgressColor(goal.progress)}`}>
          {goal.progress}%
        </span>
        {goal.completed && <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />}
        {goal.onHold && <PauseCircle className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
      </button>
      {isDetailOpen && (
        <GoalDetailPanel
          title={goal.title}
          description={goal.description}
          progress={goal.progress}
          startDate={goal.startDate}
          dueDate={goal.dueDate}
          statusNote={goal.statusNote}
          completed={goal.completed}
          onHold={goal.onHold}
          subGoals={goal.subGoals}
          onOpenDetail={onOpenDetail}
          goalId={goal.id}
          itemId={goal.id}
        />
      )}
    </div>
  );
}

function SubGoalItem({
  subGoal,
  onOpenDetail,
  highlightItemId,
}: {
  subGoal: SubGoalWithParent;
  onOpenDetail: (goalId: string, itemId?: string) => void;
  highlightItemId: string | null;
}) {
  useTranslation();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const isCompleted = subGoal.progress === 100;

  return (
    <div data-highlight-id={subGoal.id}>
      <button
        onClick={() => setIsDetailOpen(!isDetailOpen)}
        className="w-full text-left px-2 py-1.5 rounded transition-all flex items-center gap-2 hover:bg-muted/50"
      >
        {isDetailOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
        <span className={`text-xs flex-1 truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
          {subGoal.title}
        </span>
        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
          {subGoal.parentGoalTitle}
        </span>
        {(subGoal.startDate || subGoal.dueDate) && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
            <Clock className="h-2.5 w-2.5" />
            {subGoal.dueDate || subGoal.startDate}
          </span>
        )}
        <span className={`text-xs font-medium ${getProgressColor(subGoal.progress)}`}>
          {subGoal.progress}%
        </span>
      </button>
      {isDetailOpen && (
        <GoalDetailPanel
          title={subGoal.title}
          description={subGoal.description}
          progress={subGoal.progress}
          startDate={subGoal.startDate}
          dueDate={subGoal.dueDate}
          statusNote={subGoal.statusNote}
          parentGoalTitle={subGoal.parentGoalTitle}
          onOpenDetail={onOpenDetail}
          goalId={subGoal.parentGoalId}
          itemId={subGoal.id}
        />
      )}
    </div>
  );
}

// ============================================================
// List View Item Components
// ============================================================

function GoalRow({
  goal,
  onOpenDetail,
  highlightItemId,
}: {
  goal: GoalWithRole;
  onOpenDetail: (goalId: string, itemId?: string) => void;
  highlightItemId: string | null;
}) {
  useTranslation();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  return (
    <div data-highlight-id={goal.id}>
      <button
        onClick={() => setIsDetailOpen(!isDetailOpen)}
        className="w-full text-left px-3 py-2 rounded transition-all flex items-center gap-3 hover:bg-muted/50"
      >
        {isDetailOpen ? <ChevronDown className="h-4 w-4 text-primary flex-shrink-0" /> : <Target className="h-4 w-4 text-primary flex-shrink-0" />}
        <span className={`text-sm flex-1 truncate ${goal.completed ? 'line-through text-muted-foreground' : ''} ${goal.onHold ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
          {goal.title}
        </span>
        {goal.dueDate && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {goal.dueDate}
          </span>
        )}
        <div className="flex items-center gap-2 w-24">
          <Progress value={goal.progress} className="h-1.5 flex-1" />
          <span className={`text-xs font-medium w-8 text-right ${getProgressColor(goal.progress)}`}>
            {goal.progress}%
          </span>
        </div>
        {goal.completed && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
        {goal.onHold && <PauseCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
      </button>
      {isDetailOpen && (
        <GoalDetailPanel
          title={goal.title}
          description={goal.description}
          progress={goal.progress}
          startDate={goal.startDate}
          dueDate={goal.dueDate}
          statusNote={goal.statusNote}
          completed={goal.completed}
          onHold={goal.onHold}
          subGoals={goal.subGoals}
          onOpenDetail={onOpenDetail}
          goalId={goal.id}
          itemId={goal.id}
        />
      )}
    </div>
  );
}

function SubGoalRow({
  subGoal,
  onOpenDetail,
  highlightItemId,
}: {
  subGoal: SubGoalWithParent;
  onOpenDetail: (goalId: string, itemId?: string) => void;
  highlightItemId: string | null;
}) {
  useTranslation();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const isCompleted = subGoal.progress === 100;

  return (
    <div className="ml-4" data-highlight-id={subGoal.id}>
      <button
        onClick={() => setIsDetailOpen(!isDetailOpen)}
        className="w-full text-left px-3 py-2 rounded transition-all flex items-center gap-3 hover:bg-muted/50"
      >
        {isDetailOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
        <span className={`text-sm flex-1 truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
          {subGoal.title}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {subGoal.parentGoalTitle}
        </Badge>
        {(subGoal.startDate || subGoal.dueDate) && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3" />
            {subGoal.startDate && subGoal.startDate}
            {subGoal.startDate && subGoal.dueDate && ' ~ '}
            {subGoal.dueDate && !subGoal.startDate && subGoal.dueDate}
            {subGoal.dueDate && subGoal.startDate && subGoal.dueDate}
          </span>
        )}
        <div className="flex items-center gap-2 w-24">
          <Progress value={subGoal.progress} className="h-1.5 flex-1" />
          <span className={`text-xs font-medium w-8 text-right ${getProgressColor(subGoal.progress)}`}>
            {subGoal.progress}%
          </span>
        </div>
      </button>
      {isDetailOpen && (
        <GoalDetailPanel
          title={subGoal.title}
          description={subGoal.description}
          progress={subGoal.progress}
          startDate={subGoal.startDate}
          dueDate={subGoal.dueDate}
          statusNote={subGoal.statusNote}
          parentGoalTitle={subGoal.parentGoalTitle}
          onOpenDetail={onOpenDetail}
          goalId={subGoal.parentGoalId}
          itemId={subGoal.id}
        />
      )}
    </div>
  );
}

// ============================================================
// Goal Sheet Content (Side Panel)
// ============================================================

function GoalSheetContent({
  goal,
  highlightSubGoalId,
  onEdit,
}: {
  goal: Goal;
  highlightSubGoalId?: string | null;
  onEdit: () => void;
}) {
  useTranslation();
  // Scroll to highlighted sub-goal inside the side panel
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

      {/* Status & Owner */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          <User className="h-3 w-3 mr-1" />
          {(goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner]).join(', ')}
        </Badge>
        {goal.completed && (
          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />{t("완료")}</Badge>
        )}
        {goal.onHold && (
          <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <PauseCircle className="h-3 w-3 mr-1" />{t("보류")}</Badge>
        )}
        {goal.categories?.map((cat) => (
          <Badge key={cat} variant="secondary" className="text-xs">
            {cat}
          </Badge>
        ))}
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("진행률")}</span>
          <span className={`font-semibold ${getProgressColor(goal.progress)}`}>{goal.progress}%</span>
        </div>
        <Progress value={goal.progress} className="h-2" />
      </div>

      {/* Dates */}
      {(goal.startDate || goal.dueDate) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          {goal.startDate && <span>{goal.startDate}</span>}
          {goal.startDate && goal.dueDate && <span>~</span>}
          {goal.dueDate && <span>{goal.dueDate}</span>}
        </div>
      )}

      {/* Description */}
      {goal.description && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <FileText className="h-4 w-4" />{t("설명")}</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words bg-muted/30 rounded-md p-3">
            {goal.description}
          </p>
        </div>
      )}

      {/* Status Note */}
      {goal.statusNote && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">{t("상태 메모")}</h4>
          <div className="text-sm text-muted-foreground italic whitespace-pre-wrap break-words bg-muted/30 rounded-md p-3 border-l-2 border-primary/30">
            {goal.statusNote}
          </div>
        </div>
      )}

      {/* Sub-goals */}
      {goal.subGoals && goal.subGoals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <Target className="h-4 w-4" />{t("하위목표 (")}{goal.subGoals.length})
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

      {/* Notes */}
      {goal.notes && goal.notes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <StickyNote className="h-4 w-4" />{t("메모 (")}{goal.notes.length})
          </h4>
          <div className="space-y-2">
            {goal.notes.map((note) => (
              <div key={note.id} className="bg-muted/30 rounded-md p-3 text-sm">
                <p className="whitespace-pre-wrap break-words">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(note.createdAt).toLocaleDateString(getLocale())}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {goal.attachments && goal.attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <Paperclip className="h-4 w-4" />{t("첨부파일 (")}{goal.attachments.length})
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

      {/* Navigate to edit */}
      <div className="pt-2 border-t">
        <Button variant="default" size="sm" className="w-full" onClick={onEdit}>
          <FileText className="h-4 w-4 mr-2" />{t("편집")}</Button>
      </div>
    </div>
  );
}
