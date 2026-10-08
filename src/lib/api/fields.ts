import { t } from '@/i18n';
import { API_BASE_URL, getAuthHeaders, throwApiError } from '@/lib/api/http';
import { FieldSchema, StatusLabel, CustomFieldDefinition } from '@/types/fields';

export const fieldsApi = {
  async getFieldSchema(projectId: string): Promise<FieldSchema> {
    const res = await fetch(`${API_BASE_URL}/api/field-schema?projectId=${projectId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) await throwApiError(res, t("필드 스키마를 불러오지 못했습니다."));
    return res.json();
  },

  // --- Status labels (org-scoped, OWNER/ADMIN) ---
  async createStatusLabel(name: string, color: string): Promise<StatusLabel> {
    const res = await fetch(`${API_BASE_URL}/api/status-labels`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) await throwApiError(res, t("상태 라벨 생성에 실패했습니다."));
    return res.json();
  },

  async updateStatusLabel(id: string, data: { name?: string; color?: string; order?: number }): Promise<StatusLabel> {
    const res = await fetch(`${API_BASE_URL}/api/status-labels/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwApiError(res, t("상태 라벨 수정에 실패했습니다."));
    return res.json();
  },

  async deleteStatusLabel(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/status-labels/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) await throwApiError(res, t("상태 라벨 삭제에 실패했습니다."));
  },

  // --- Custom field definitions (project-scoped, OWNER/ADMIN) ---
  async createField(projectId: string, data: { name: string; type: string; config?: unknown }): Promise<CustomFieldDefinition> {
    const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/fields`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwApiError(res, t("필드 생성에 실패했습니다."));
    return res.json();
  },

  async updateField(id: string, data: { name?: string; config?: unknown; order?: number }): Promise<CustomFieldDefinition> {
    const res = await fetch(`${API_BASE_URL}/api/fields/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) await throwApiError(res, t("필드 수정에 실패했습니다."));
    return res.json();
  },

  async deleteField(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/fields/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) await throwApiError(res, t("필드 삭제에 실패했습니다."));
  },

  // --- Goal writes ---
  // 상태 라벨 설정(칸반 드래그·상태 셀). version 낙관적 잠금 — 불일치 시 409(ApiError.data.currentData).
  // 서버는 갱신된 goal 전체(+ statusResult)를 반환하므로 version 도 포함된다.
  async setGoalStatus(goalId: string, statusId: string, version?: number): Promise<{ statusId: string; completed: boolean; onHold: boolean; version?: number }> {
    const res = await fetch(`${API_BASE_URL}/api/goals/${goalId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ statusId, version }),
    });
    if (!res.ok) await throwApiError(res, t("상태 변경에 실패했습니다."));
    return res.json();
  },

  // 커스텀 필드 값 설정(versionless upsert).
  async setGoalFieldValue(goalId: string, fieldId: string, value: unknown): Promise<{ id: string; customFields: Record<string, unknown> }> {
    const res = await fetch(`${API_BASE_URL}/api/goals/${goalId}/field`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fieldId, value }),
    });
    if (!res.ok) await throwApiError(res, t("필드 값 저장에 실패했습니다."));
    return res.json();
  },
};
