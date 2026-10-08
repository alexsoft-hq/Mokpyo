import { useTranslation, t, getLocale } from '@/i18n';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragStartEvent, DragEndEvent,
} from '@dnd-kit/core';
import { Plus, Loader2, Kanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/layout/AppHeader';
import { BoardColumn, BoardColumnData } from '@/components/board/BoardColumn';
import { BoardCard } from '@/components/board/BoardCard';
import { StatusLabelDialog } from '@/components/board/StatusLabelDialog';
import { AddGoalModal } from '@/components/AddGoalModal';
import { GoalDetailContainer } from '@/components/goal-panel/GoalDetailContainer';
import { EmptyState } from '@/components/common/EmptyState';
import { useSampleData } from '@/components/onboarding/useSampleData';
import { onboardingBoardVisitedKey, writeFlag } from '@/components/onboarding/storage';
import { useGoalsQuery } from '@/hooks/useGoalsQuery';
import { useFieldSchema } from '@/hooks/useFieldSchema';
import { useOrgUsers } from '@/hooks/useOrgUsers';
import { useGoalMutations } from '@/hooks/useGoalMutations';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { fieldsApi } from '@/lib/api/fields';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Goal } from '@/types/goal';
import { StatusLabel } from '@/types/fields';
import { toast } from 'sonner';

const DONE_CAP = 20;

export default function BoardView() {
  useTranslation();
  const locale = getLocale();
  const qc = useQueryClient();
  const { currentProject } = useProject();
  const { currentOrganization } = useWorkspace();
  const projectId = currentProject?.id ?? null;
  const canManage = currentOrganization?.role === 'OWNER' || currentOrganization?.role === 'ADMIN';

  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [labelDialog, setLabelDialog] = useState<{ open: boolean; label: StatusLabel | null }>({ open: false, label: null });
  const [addOpen, setAddOpen] = useState(false);
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

  const goalsQuery = useGoalsQuery({ showCompleted: true, showOnHold: true }, { editing: !!activeGoal });
  const schemaQuery = useFieldSchema();
  const usersQuery = useOrgUsers();
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(projectId),
    queryFn: () => api.getCategories(projectId as string),
    enabled: !!projectId,
  });
  const { setStatus } = useGoalMutations();
  const { loadSample, loading: sampleLoading } = useSampleData();

  // 온보딩 체크리스트의 '보드에서 상태 바꿔보기' 완료 표시
  useEffect(() => {
    if (currentOrganization?.id) writeFlag(onboardingBoardVisitedKey(currentOrganization.id));
  }, [currentOrganization?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const goals = goalsQuery.data ?? [];
  const labels = schemaQuery.data?.statusLabels ?? [];

  const columns = useMemo<BoardColumnData[]>(() => {
    const byStatus = new Map<string, Goal[]>();
    labels.forEach((l) => byStatus.set(l.id, []));
    const noneGoals: Goal[] = [];
    for (const g of goals) {
      if (g.statusId && byStatus.has(g.statusId)) byStatus.get(g.statusId)!.push(g);
      else noneGoals.push(g);
    }
    const cols: BoardColumnData[] = labels.map((l) => ({
      id: l.id, name: l.name, color: l.color, kind: l.kind, isSystem: l.isSystem, goals: byStatus.get(l.id) ?? [],
    }));
    // 상태 없음(NULL statusId) 폴백 컬럼 — 목표가 화면에서 사라지지 않게
    if (noneGoals.length > 0) cols.push({ id: '__none__', name: t("상태 없음"), goals: noneGoals });
    return cols;
  }, [labels, goals, locale]);

  const findGoal = (id: string) => goals.find((g) => g.id === id);

  const handleDragStart = (e: DragStartEvent) => setActiveGoal(findGoal(String(e.active.id)) ?? null);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveGoal(null);
    const { active, over } = e;
    if (!over) return;
    const goal = findGoal(String(active.id));
    if (!goal) return;
    // over 가 카드면 그 카드의 컬럼, 컬럼이면 컬럼 id
    const overGoal = findGoal(String(over.id));
    const targetColumnId = overGoal ? overGoal.statusId ?? '__none__' : String(over.id);
    if (!targetColumnId || targetColumnId === '__none__') return; // 상태 없음으로는 이동 불가
    if (goal.statusId === targetColumnId) return; // 같은 컬럼
    setStatus(goal.id, targetColumnId, goal.version).catch(() => {});
  };

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleLabelSubmit = async (data: { name: string; color: string }) => {
    try {
      if (labelDialog.label) {
        await fieldsApi.updateStatusLabel(labelDialog.label.id, data);
        toast.success(t("상태를 수정했습니다."));
      } else {
        await fieldsApi.createStatusLabel(data.name, data.color);
        toast.success(t("상태를 추가했습니다."));
      }
      qc.invalidateQueries({ queryKey: ['fieldSchema'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("저장에 실패했습니다."));
      throw e;
    }
  };

  const handleDeleteLabel = async (label: StatusLabel) => {
    if (!confirm(t("'{{value0}}' 상태를 삭제할까요? 이 상태의 목표는 '시작 전'으로 이동합니다.", { value0: label.name }))) return;
    try {
      await fieldsApi.deleteStatusLabel(label.id);
      qc.invalidateQueries({ queryKey: ['fieldSchema'] });
      qc.invalidateQueries({ queryKey: ['goals'] });
      toast.success(t("상태를 삭제했습니다."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("삭제에 실패했습니다."));
    }
  };

  const loading = goalsQuery.isLoading || schemaQuery.isLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader
        showTabs
        actions={canManage ? (
          <Button size="sm" variant="outline" className="h-9" onClick={() => setLabelDialog({ open: true, label: null })}>
            <Plus className="h-4 w-4 mr-1" />{t("상태 추가")}</Button>
        ) : undefined}
      />

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !projectId ? (
          <div className="text-center text-muted-foreground py-20">{t("프로젝트를 선택하세요.")}</div>
        ) : goals.length === 0 ? (
          <EmptyState
            icon={Kanban}
            title={t("보드에 올릴 목표가 없습니다")}
            description={t("목표를 추가하면 상태별 칸에 카드로 나타나고, 끌어다 놓아 상태를 바꿀 수 있습니다.")}
            primaryAction={{ label: t("새 목표"), onClick: () => setAddOpen(true) }}
            secondaryAction={{ label: t("샘플 데이터로 둘러보기"), onClick: loadSample, loading: sampleLoading }}
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto p-4 md:p-6 h-full items-start">
              {columns.map((col) => (
                <BoardColumn
                  key={col.id}
                  column={col}
                  users={usersQuery.data ?? []}
                  collapsed={collapsed.has(col.id)}
                  onToggleCollapse={() => toggleCollapse(col.id)}
                  canManage={canManage}
                  doneCap={DONE_CAP}
                  onOpenGoal={(g) => openDetail(g.id)}
                  onRename={() => setLabelDialog({ open: true, label: labels.find((l) => l.id === col.id) ?? null })}
                  onDelete={() => { const l = labels.find((x) => x.id === col.id); if (l) handleDeleteLabel(l); }}
                  onAddGoal={() => setAddOpen(true)}
                />
              ))}
            </div>
            <DragOverlay>
              {activeGoal ? (
                <div className="w-72"><BoardCard goal={activeGoal} users={usersQuery.data ?? []} onOpen={() => {}} dragging /></div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <StatusLabelDialog
        open={labelDialog.open}
        onClose={() => setLabelDialog({ open: false, label: null })}
        label={labelDialog.label}
        onSubmit={handleLabelSubmit}
      />

      {addOpen && (
        <AddGoalModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={async (goal) => {
            try {
              await api.createGoal({ ...goal, projectId: projectId ?? undefined } as Goal);
              qc.invalidateQueries({ queryKey: ['goals'] });
              setAddOpen(false);
              toast.success(t("목표가 추가되었습니다."));
            } catch (e) { toast.error(e instanceof Error ? e.message : t("추가 실패")); }
          }}
          categories={(categoriesQuery.data ?? []).map((c) => c.name)}
          categoryColors={Object.fromEntries((categoriesQuery.data ?? []).map((c) => [c.name, c.color]))}
          registeredUsers={usersQuery.data ?? []}
          existingOwners={usersQuery.data?.map((u) => u.name) ?? []}
          goals={goals}
        />
      )}

      <GoalDetailContainer
        goalId={detailGoalId}
        open={!!detailGoalId}
        onClose={closeDetail}
      />
    </div>
  );
}
