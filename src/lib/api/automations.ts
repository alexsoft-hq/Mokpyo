import { API_BASE_URL, getAuthHeaders, throwApiError } from '@/lib/api/http';

export interface AutomationAction { type: string; config: Record<string, unknown>; }
export interface AutomationCondition { attr: string; op: 'eq' | 'neq' | 'in'; value: unknown; }

export interface AutomationRule {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  condition: AutomationCondition[] | null;
  actions: AutomationAction[];
  disabledReason: string | null;
  lastRunAt: string | null;
  runCount: number;
}

export interface AutomationExecution {
  id: string;
  status: string;
  detail: Record<string, unknown> | null;
  durationMs: number | null;
  goalId: string | null;
  createdAt: string;
}

export interface RuleInput {
  projectId: string;
  name: string;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  condition?: AutomationCondition[] | null;
  actions: AutomationAction[];
  enabled?: boolean;
}

export const automationsApi = {
  async list(projectId: string): Promise<AutomationRule[]> {
    const res = await fetch(`${API_BASE_URL}/api/automations?projectId=${projectId}`, { headers: getAuthHeaders() });
    if (!res.ok) await throwApiError(res, '자동화를 불러오지 못했습니다.');
    return res.json();
  },
  async create(data: RuleInput): Promise<AutomationRule> {
    const res = await fetch(`${API_BASE_URL}/api/automations`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!res.ok) await throwApiError(res, '자동화 생성에 실패했습니다.');
    return res.json();
  },
  async update(id: string, data: Partial<RuleInput>): Promise<AutomationRule> {
    const res = await fetch(`${API_BASE_URL}/api/automations/${id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!res.ok) await throwApiError(res, '자동화 수정에 실패했습니다.');
    return res.json();
  },
  async toggle(id: string, enabled: boolean): Promise<AutomationRule> {
    const res = await fetch(`${API_BASE_URL}/api/automations/${id}/toggle`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ enabled }) });
    if (!res.ok) await throwApiError(res, '토글에 실패했습니다.');
    return res.json();
  },
  async remove(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/automations/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!res.ok) await throwApiError(res, '삭제에 실패했습니다.');
  },
  async executions(id: string): Promise<AutomationExecution[]> {
    const res = await fetch(`${API_BASE_URL}/api/automations/${id}/executions`, { headers: getAuthHeaders() });
    if (!res.ok) await throwApiError(res, '실행 이력을 불러오지 못했습니다.');
    return res.json();
  },
};

// 카탈로그 — 문장형 빌더 라벨. 신규 트리거/액션 추가 시 여기 한 줄.
export const TRIGGER_CATALOG: { value: string; label: string; needs?: 'status' | 'progress' | 'days' }[] = [
  { value: 'goal_created', label: '목표가 생성되면' },
  { value: 'status_changed', label: '상태가 특정 값으로 바뀌면', needs: 'status' },
  { value: 'assignee_changed', label: '담당자가 지정되면' },
  { value: 'progress_reached', label: '진행률이 N%에 도달하면', needs: 'progress' },
  { value: 'due_date_approaching', label: '마감일이 다가오면', needs: 'days' },
  { value: 'due_date_arrived', label: '마감일이 되면' },
];

export const ACTION_CATALOG: { value: string; label: string; needs?: 'status' | 'people' | 'text' | 'field' | 'webhook' }[] = [
  { value: 'notify_person', label: '담당자/사용자에게 알림 보내기', needs: 'people' },
  { value: 'change_status', label: '상태 변경', needs: 'status' },
  { value: 'assign_person', label: '담당자 지정', needs: 'people' },
  { value: 'create_comment', label: '댓글 작성', needs: 'text' },
  { value: 'set_field', label: '커스텀 필드 설정', needs: 'field' },
  { value: 'send_webhook', label: '웹훅 보내기(외부 시스템 연동)', needs: 'webhook' },
];
