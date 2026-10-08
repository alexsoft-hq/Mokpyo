import { t } from '@/i18n';
import { API_BASE_URL, getAuthHeaders, throwApiError } from '@/lib/api/http';
import { Goal } from '@/types/goal';

// 테이블 인라인 편집용 부분 업데이트. 전체 PUT(GoalDetailModal)과 달리 화이트리스트 스칼라만 전송해
// 409 폭풍을 피한다. version 불일치 시 ApiError(status 409, data.currentData) 로 throw.
export type GoalPatch = Partial<
  Pick<Goal, 'title' | 'owner' | 'progress' | 'size' | 'startDate' | 'dueDate' | 'statusNote' | 'cycleId' | 'completed' | 'onHold'>
>;

export const goalsApi = {
  async patchGoal(id: string, patch: GoalPatch, version?: number): Promise<Goal> {
    const res = await fetch(`${API_BASE_URL}/api/goals/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...patch, version }),
    });
    if (!res.ok) await throwApiError(res, t("목표 수정에 실패했습니다."));
    return res.json();
  },
};
