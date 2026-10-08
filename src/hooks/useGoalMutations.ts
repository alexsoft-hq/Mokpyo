import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { goalsApi, GoalPatch } from '@/lib/api/goals';
import { fieldsApi } from '@/lib/api/fields';
import { ApiError } from '@/lib/api/http';
import { Goal } from '@/types/goal';

// ['goals', ...] 로 시작하는 모든 캐시에서 goalId 를 patch/치환. 낙관적 업데이트·롤백 공용.
function patchGoalInCaches(qc: ReturnType<typeof useQueryClient>, goalId: string, patch: Partial<Goal>) {
  const snapshots: [readonly unknown[], Goal[] | undefined][] = [];
  qc.getQueryCache()
    .findAll({ queryKey: ['goals'] })
    .forEach((q) => {
      const data = q.state.data as Goal[] | undefined;
      if (!Array.isArray(data)) return;
      snapshots.push([q.queryKey, data]);
      qc.setQueryData(
        q.queryKey,
        data.map((g) => (g.id === goalId ? { ...g, ...patch } : g))
      );
    });
  return snapshots;
}

function restore(qc: ReturnType<typeof useQueryClient>, snapshots: [readonly unknown[], Goal[] | undefined][]) {
  for (const [key, data] of snapshots) qc.setQueryData(key, data);
}

/**
 * 테이블/보드 인라인 편집용 목표 mutation. 낙관적 캐시 패치 + 실패 롤백 + 409 처리.
 * - patchGoal: 스칼라 셀(제목/진행률/날짜/…) → PATCH, version 낙관적 잠금
 * - setStatus: 상태 라벨(권위 경로), completed/onHold 미러 반영
 * - setFieldValue: 커스텀 필드(versionless)
 */
export function useGoalMutations() {
  const qc = useQueryClient();

  const invalidate = useCallback(
    (goalId: string) => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      qc.invalidateQueries({ queryKey: ['goal', goalId] });
    },
    [qc]
  );

  const handleConflict = useCallback(
    (err: unknown, goalId: string) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('다른 사용자가 먼저 수정했습니다. 최신 데이터로 갱신합니다.');
        const currentData = (err.data as { currentData?: Goal })?.currentData;
        if (currentData) patchGoalInCaches(qc, goalId, currentData);
        invalidate(goalId);
        return true;
      }
      return false;
    },
    [qc, invalidate]
  );

  const patchGoal = useCallback(
    async (goalId: string, patch: GoalPatch, version?: number) => {
      const snapshots = patchGoalInCaches(qc, goalId, patch as Partial<Goal>);
      try {
        const updated = await goalsApi.patchGoal(goalId, patch, version);
        patchGoalInCaches(qc, goalId, updated);
        qc.invalidateQueries({ queryKey: ['goal', goalId] });
        return updated;
      } catch (err) {
        restore(qc, snapshots);
        if (!handleConflict(err, goalId)) {
          toast.error(err instanceof Error ? err.message : '수정에 실패했습니다.');
        }
        throw err;
      }
    },
    [qc, handleConflict]
  );

  const setStatus = useCallback(
    async (goalId: string, statusId: string, version?: number) => {
      // 상태 변경은 completed/onHold 미러에 영향 → 서버 응답 후 반영. 낙관적으로 statusId 만 먼저.
      const snapshots = patchGoalInCaches(qc, goalId, { statusId });
      try {
        const res = await fieldsApi.setGoalStatus(goalId, statusId, version);
        // 서버가 version 을 증가시키므로 캐시에도 반영 — 안 하면 다음 편집이 stale version 으로 가짜 409
        patchGoalInCaches(qc, goalId, { statusId, completed: res.completed, onHold: res.onHold, ...(res.version !== undefined ? { version: res.version } : {}) });
        return res;
      } catch (err) {
        restore(qc, snapshots);
        if (!handleConflict(err, goalId)) {
          toast.error(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
        }
        throw err;
      }
    },
    [qc, handleConflict]
  );

  const setFieldValue = useCallback(
    async (goalId: string, fieldId: string, value: unknown, currentCustomFields: Record<string, unknown>) => {
      const optimistic = { ...currentCustomFields, [fieldId]: value };
      if (value === null) delete optimistic[fieldId];
      const snapshots = patchGoalInCaches(qc, goalId, { customFields: optimistic });
      try {
        const res = await fieldsApi.setGoalFieldValue(goalId, fieldId, value);
        patchGoalInCaches(qc, goalId, { customFields: res.customFields });
        return res;
      } catch (err) {
        restore(qc, snapshots);
        toast.error(err instanceof Error ? err.message : '필드 저장에 실패했습니다.');
        throw err;
      }
    },
    [qc]
  );

  return { patchGoal, setStatus, setFieldValue };
}
