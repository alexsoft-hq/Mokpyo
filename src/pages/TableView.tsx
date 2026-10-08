import { useTranslation, t } from '@/i18n';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SortingState, VisibilityState } from '@tanstack/react-table';
import { Search, Plus, Settings2, Loader2, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AppHeader } from '@/components/layout/AppHeader';
import { GoalTable } from '@/components/goal-table/GoalTable';
import { GroupByKey } from '@/components/goal-table/groupGoals';
import { SavedViewsMenu } from '@/components/goal-table/SavedViewsMenu';
import { SavedView } from '@/lib/api/views';
import { AddGoalModal } from '@/components/AddGoalModal';
import { GoalDetailContainer } from '@/components/goal-panel/GoalDetailContainer';
import { useGoalsQuery } from '@/hooks/useGoalsQuery';
import { useFieldSchema } from '@/hooks/useFieldSchema';
import { useOrgUsers } from '@/hooks/useOrgUsers';
import { useGoalMutations } from '@/hooks/useGoalMutations';
import { useProject } from '@/contexts/ProjectContext';
import { api, Cycle } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { csvFileName, downloadCsv, goalsToCsv } from '@/lib/exportCsv';
import { Goal } from '@/types/goal';
import { toast } from 'sonner';

const GROUP_OPTIONS: { value: GroupByKey; label: string }[] = [
  { value: 'none', label: '그룹 없음' },
  { value: 'status', label: '상태별' },
  { value: 'category', label: '분류별' },
  { value: 'owner', label: '담당자별' },
  { value: 'cycle', label: '사이클별' },
];

const COLUMN_LABELS: Record<string, string> = {
  status: '상태', title: '목표', owners: '담당자', progress: '진행률', size: '중요도',
  startDate: '시작일', dueDate: '마감일', categories: '분류', cycle: '사이클',
};

export default function TableView() {
  useTranslation();
  const qc = useQueryClient();
  const { currentProject } = useProject();
  const projectId = currentProject?.id ?? null;
  const storageKey = `mokpyo_table_settings_${projectId ?? 'none'}`;
  const legacyStorageKey = `goalboard_table_settings_${projectId ?? 'none'}`;

  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupByKey>('status');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  // 상세 패널은 URL ?item=<id> 로 표현 → 제자리 오픈이면서 새로고침·공유링크·뒤로가기 지원
  const [searchParams, setSearchParams] = useSearchParams();
  const detailGoalId = searchParams.get('item');
  const openDetail = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('item', id);
    setSearchParams(next);
  };
  const closeDetail = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('item');
    setSearchParams(next);
  };

  const applyView = (view: SavedView) => {
    const c = view.config as { groupBy?: GroupByKey; sorting?: SortingState; columnVisibility?: VisibilityState };
    if (c.groupBy) setGroupBy(c.groupBy);
    if (c.sorting) setSorting(c.sorting);
    if (c.columnVisibility) setColumnVisibility(c.columnVisibility);
    setActiveViewId(view.id);
  };

  // localStorage 복원
  useEffect(() => {
    if (!projectId) return;
    try {
      // 프로젝트 이름 변경 전 저장값도 읽고, 아래 저장 effect에서 새 키로 이관한다.
      const raw = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.groupBy) setGroupBy(s.groupBy);
        if (s.sorting) setSorting(s.sorting);
        if (s.columnVisibility) setColumnVisibility(s.columnVisibility);
        if (Array.isArray(s.collapsedGroups)) setCollapsedGroups(new Set(s.collapsedGroups));
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem(storageKey, JSON.stringify({ groupBy, sorting, columnVisibility, collapsedGroups: [...collapsedGroups] }));
  }, [projectId, storageKey, groupBy, sorting, columnVisibility, collapsedGroups]);

  const goalsQuery = useGoalsQuery({ showCompleted, showOnHold: true });
  const schemaQuery = useFieldSchema();
  const usersQuery = useOrgUsers();
  const cyclesQuery = useQuery<Cycle[]>({ queryKey: queryKeys.cycles(currentProject ? 'org' : null), queryFn: () => api.getCycles(), staleTime: 60_000 });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(projectId),
    queryFn: () => api.getCategories(projectId as string),
    enabled: !!projectId,
  });

  const { patchGoal, setStatus, setFieldValue } = useGoalMutations();

  const goals = goalsQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return goals;
    return goals.filter((g) =>
      g.title.toLowerCase().includes(q) ||
      (g.owners ?? []).some((o) => o.toLowerCase().includes(q)) ||
      (g.categories ?? []).some((c) => c.toLowerCase().includes(q))
    );
  }, [goals, search]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const categories = (categoriesQuery.data ?? []).map((c) => c.name);
  const categoryColors = Object.fromEntries((categoriesQuery.data ?? []).map((c) => [c.name, c.color]));

  const handleAdd = async (goal: Goal) => {
    try {
      await api.createGoal({ ...goal, projectId: projectId ?? undefined } as Goal);
      qc.invalidateQueries({ queryKey: ['goals'] });
      setAddOpen(false);
      toast.success(t("목표가 추가되었습니다."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("목표 추가에 실패했습니다."));
    }
  };

  // 화면에 보이는 그대로(현재 검색·완료 포함 설정) 내보낸다.
  const handleExport = () => {
    try {
      const csv = goalsToCsv(filtered, {
        fieldDefs: schemaQuery.data?.customFields ?? [],
        statusLabels: schemaQuery.data?.statusLabels ?? [],
        cycles: (cyclesQuery.data ?? []).map((c) => ({ id: c.id, name: c.name })),
      });
      downloadCsv(csvFileName(currentProject?.name), csv);
      toast.success(t("{{value0}}개 목표를 내보냈습니다.", { value0: filtered.length }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("내보내기에 실패했습니다."));
    }
  };

  const loading = goalsQuery.isLoading || schemaQuery.isLoading;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showTabs />

      {/* 툴바 */}
      <div className="px-4 md:px-6 py-3 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("제목·담당자·분류 검색")} className="pl-8 h-9 w-56" />
        </div>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByKey)}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>)}
          </SelectContent>
        </Select>
        {projectId && (
          <SavedViewsMenu
            projectId={projectId}
            viewType="table"
            currentConfig={{ groupBy, sorting, columnVisibility }}
            activeViewId={activeViewId}
            onApply={applyView}
          />
        )}
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <Checkbox checked={showCompleted} onCheckedChange={(c) => setShowCompleted(!!c)} />{t("완료 포함")}</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9"><Settings2 className="h-4 w-4 mr-1" />{t("컬럼")}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="flex flex-col gap-1">
              {Object.entries(COLUMN_LABELS).map(([id, label]) => (
                <label key={id} className="flex items-center gap-2 text-sm px-1 py-0.5 cursor-pointer">
                  <Checkbox
                    checked={columnVisibility[id] !== false}
                    onCheckedChange={(c) => setColumnVisibility((v) => ({ ...v, [id]: !!c }))}
                    disabled={id === 'title'}
                  />
                  {t(label)}
                </label>
              ))}
              {(schemaQuery.data?.customFields ?? []).map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm px-1 py-0.5 cursor-pointer">
                  <Checkbox
                    checked={columnVisibility[`field:${f.id}`] !== false}
                    onCheckedChange={(c) => setColumnVisibility((v) => ({ ...v, [`field:${f.id}`]: !!c }))}
                  />
                  {f.name}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={handleExport}
          disabled={filtered.length === 0}
          aria-label={t("현재 목록을 CSV 파일로 내보내기")}
        >
          <Download className="h-4 w-4 mr-1" />{t("내보내기")}</Button>
        <Button size="sm" className="h-9" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />{t("새 목표")}</Button>
      </div>

      <div className="px-4 md:px-6 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !projectId ? (
          <div className="text-center text-muted-foreground py-20">{t("프로젝트를 선택하세요.")}</div>
        ) : schemaQuery.data ? (
          <GoalTable
            goals={filtered}
            schema={schemaQuery.data}
            users={usersQuery.data ?? []}
            cycles={(cyclesQuery.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
            groupBy={groupBy}
            sorting={sorting}
            onSortingChange={setSorting}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            onStatusChange={(g, sid) => setStatus(g.id, sid, g.version).catch(() => {})}
            onPatch={(g, patch) => patchGoal(g.id, patch as any, g.version).catch(() => {})}
            onFieldChange={(g, defId, value) => setFieldValue(g.id, defId, value, g.customFields ?? {}).catch(() => {})}
            onOpenPanel={(g) => openDetail(g.id)}
          />
        ) : null}
      </div>

      <GoalDetailContainer
        goalId={detailGoalId}
        open={!!detailGoalId}
        onClose={closeDetail}
      />

      {addOpen && (
        <AddGoalModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={handleAdd}
          categories={categories}
          categoryColors={categoryColors}
          registeredUsers={usersQuery.data ?? []}
          existingOwners={usersQuery.data?.map((u) => u.name) ?? []}
          cycles={cyclesQuery.data ?? []}
          goals={goals}
        />
      )}
    </div>
  );
}
