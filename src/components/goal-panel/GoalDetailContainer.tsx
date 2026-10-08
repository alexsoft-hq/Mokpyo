import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, Cycle } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Goal } from '@/types/goal';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useOrgUsers } from '@/hooks/useOrgUsers';
import { useGoalsQuery } from '@/hooks/useGoalsQuery';
import { GoalViewDialog } from '@/components/GoalViewDialog';
import { GoalDetailModal } from '@/components/GoalDetailModal';

interface GoalDetailContainerProps {
  /** 상세를 열 목표 id. null 이면 닫힘. */
  goalId: string | null;
  open: boolean;
  onClose: () => void;
}

/**
 * 목표 상세를 "제자리(in-place)"로 여는 자립형 컨테이너.
 *
 * 테이블(/table)·보드(/board) 뷰에서 목표를 클릭하면 카드 페이지로 네비게이트하지 않고
 * 이 컨테이너가 우측 Sheet(보기) ↔ 중앙 Dialog(편집)를 그 자리에서 띄운다.
 * 실제 UI 는 기존 GoalViewDialog / GoalDetailModal 을 그대로 재사용하고,
 * 여기서는 열기·보기↔편집 전환·저장/삭제/완료/보류/복사의 오케스트레이션만 담당한다.
 *
 * react-query 네이티브:
 * - 상세 목표는 useQuery(queryKeys.goal(id))로 구독 → goalId 전환 시 이전 요청 자동 취소(레이스 방지),
 *   변경 후 invalidate 로 자동 재조회(캐시 공유·수동 setState 불필요).
 * - 의존 데이터(카테고리·사이클·목표목록)는 enabled 로 패널이 열렸을 때만 조회(불필요한 네트워크 방지).
 * - 변경 후 ['goals'] invalidate → host 의 테이블/보드가 자동 갱신.
 * (Index.tsx 는 명령형 로컬 상태 기반이라 별도 인라인 다이얼로그를 유지 — 이 컨테이너 미사용.)
 */
export function GoalDetailContainer({ goalId, open, onClose }: GoalDetailContainerProps) {
  const qc = useQueryClient();
  const { currentProject, projects, projectTree, setCurrentProject } = useProject();
  const { currentOrganization } = useWorkspace();
  const projectId = currentProject?.id ?? null;
  const canManage = currentOrganization?.role === 'OWNER' || currentOrganization?.role === 'ADMIN';

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  // 삭제 성공 시 handleDelete 가 true 로 설정 → 뒤이은 모달 onClose(handleEditClose)가 보기 복귀 대신 패널 전체를 닫도록 구분.
  const justDeleted = useRef(false);

  // 상세 목표: react-query 구독. 리스트 행은 lightweight 일 수 있어 단건 재조회로 subGoals/notes/attachments/customFields 확보.
  // enabled 로 패널이 닫혀 있으면 요청 없음. goalId 전환 시 이전 getGoal 요청은 react-query 가 자동 취소 → stale-write 레이스 방지.
  const goalQuery = useQuery<Goal>({
    queryKey: queryKeys.goal(goalId ?? ''),
    queryFn: () => api.getGoal(goalId as string),
    enabled: open && !!goalId,
    staleTime: 0,
  });
  const goal = goalQuery.data ?? null;

  // 의존 데이터 — 패널이 열렸을 때만 조회(닫힘 시 불필요한 /api/cycles·/api/categories 등 방지)
  const usersQuery = useOrgUsers();
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(projectId),
    queryFn: () => api.getCategories(projectId as string),
    enabled: open && !!projectId,
  });
  const cyclesQuery = useQuery<Cycle[]>({
    queryKey: queryKeys.cycles(currentProject ? 'org' : null),
    queryFn: () => api.getCycles(),
    enabled: open,
    staleTime: 60_000,
  });
  const goalsQuery = useGoalsQuery({ showCompleted: true, showOnHold: true }, { enabled: open });

  const registeredUsers = usersQuery.data ?? [];
  const existingOwners = registeredUsers.map((u) => u.name);
  const categories = (categoriesQuery.data ?? []).map((c) => c.name);
  const categoryColors = Object.fromEntries((categoriesQuery.data ?? []).map((c) => [c.name, c.color]));

  // 열림/목표 전환 시 보기 모드로 초기화
  useEffect(() => {
    if (open && goalId) {
      setMode('view');
      justDeleted.current = false;
    }
  }, [open, goalId]);

  // 상세 조회 실패(예: 삭제된 목표·권한 없음) → 안내 후 패널 닫기
  useEffect(() => {
    if (open && !!goalId && goalQuery.isError) {
      toast.error('목표를 불러오지 못했습니다.');
      onClose();
    }
    // onClose 는 부모 인라인 콜백이라 매 렌더 변경 → 의존성 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goalId, goalQuery.isError]);

  // 변경 반영: host 목록(['goals'])과 이 패널의 단건(['goal', id]) 모두 무효화 → useQuery 가 자동 재조회
  const invalidateGoal = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['goals'] });
    if (goalId) qc.invalidateQueries({ queryKey: queryKeys.goal(goalId) });
  }, [qc, goalId]);

  const handleToggleComplete = useCallback(
    async (id: string, completed: boolean) => {
      try {
        await api.toggleGoalCompletion(id, completed);
        invalidateGoal();
      } catch {
        toast.error('목표 완료 상태 변경에 실패했습니다.');
      }
    },
    [invalidateGoal]
  );

  const handleToggleOnHold = useCallback(
    async (id: string, onHold: boolean) => {
      try {
        await api.toggleGoalOnHold(id, onHold);
        invalidateGoal();
      } catch {
        toast.error('목표 보류 상태 변경에 실패했습니다.');
      }
    },
    [invalidateGoal]
  );

  const handleSave = useCallback(
    async (updated: Goal) => {
      try {
        await api.updateGoal(updated.id, updated);
        invalidateGoal();
      } catch (err) {
        const status = (err as { response?: { status?: number }; status?: number })?.response?.status
          ?? (err as { status?: number })?.status;
        toast.error(status === 409 ? '다른 사용자가 먼저 수정했습니다. 최신 데이터로 갱신합니다.' : '목표 저장에 실패했습니다.');
        invalidateGoal();
        throw err; // 실패 시 편집 모달을 열어둔 채 편집내용 보존(모달이 성공 시에만 닫힘)
      }
    },
    [invalidateGoal]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await api.deleteGoal(id);
        justDeleted.current = true; // 성공 시에만 설정 → 모달 onClose(handleEditClose)가 패널 전체를 닫음
        toast.success('목표를 삭제했습니다.');
        qc.invalidateQueries({ queryKey: ['goals'] });
      } catch (err) {
        toast.error('목표 삭제에 실패했습니다.');
        qc.invalidateQueries({ queryKey: ['goals'] }); // 실패 시에도 목록 정합성 보정
        throw err; // 실패 시 모달 유지(성공 시에만 닫힘)
      }
    },
    [qc]
  );

  // 편집 모달 close: 삭제 직후면 패널 전체 닫기, 아니면 보기로 복귀.
  const handleEditClose = useCallback(() => {
    if (justDeleted.current) {
      justDeleted.current = false;
      onClose();
      return;
    }
    setMode('view');
  }, [onClose]);

  const handleCopySuccess = useCallback(
    (_newGoal: Goal, targetProjectId: string) => {
      onClose();
      const target = projects.find((p) => p.id === targetProjectId);
      if (target) setCurrentProject(target);
    },
    [onClose, projects, setCurrentProject]
  );

  return (
    <>
      <GoalViewDialog
        goal={goal}
        open={open && mode === 'view' && !!goal}
        onClose={onClose}
        onEdit={() => setMode('edit')}
        onToggleComplete={handleToggleComplete}
        onToggleOnHold={handleToggleOnHold}
        categories={categories}
        categoryColors={categoryColors}
        registeredUsers={registeredUsers}
        projects={projects}
        projectTree={projectTree}
        currentProjectId={currentProject?.id || ''}
        onCopySuccess={handleCopySuccess}
      />

      <GoalDetailModal
        goal={goal}
        open={open && mode === 'edit' && !!goal}
        onClose={handleEditClose}
        onSave={handleSave}
        onDelete={handleDelete}
        canDelete={canManage}
        categories={categories}
        categoryColors={categoryColors}
        registeredUsers={registeredUsers}
        existingOwners={existingOwners}
        cycles={cyclesQuery.data ?? []}
        goals={goalsQuery.data ?? []}
      />
    </>
  );
}
