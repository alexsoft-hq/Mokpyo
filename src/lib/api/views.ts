import { API_BASE_URL, getAuthHeaders, throwApiError } from '@/lib/api/http';

export interface SavedView {
  id: string;
  organizationId: string;
  projectId: string;
  createdById: string | null;
  name: string;
  type: string; // table | board | dashboard | cards | timeline
  isShared: boolean;
  isDefault: boolean;
  config: Record<string, unknown>;
  order: number;
}

export const viewsApi = {
  async list(projectId: string, type?: string): Promise<SavedView[]> {
    const q = new URLSearchParams({ projectId, ...(type ? { type } : {}) });
    const res = await fetch(`${API_BASE_URL}/api/views?${q}`, { headers: getAuthHeaders() });
    if (!res.ok) await throwApiError(res, '뷰를 불러오지 못했습니다.');
    return res.json();
  },
  async create(data: { projectId: string; name: string; type: string; isShared?: boolean; config: Record<string, unknown> }): Promise<SavedView> {
    const res = await fetch(`${API_BASE_URL}/api/views`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!res.ok) await throwApiError(res, '뷰 저장에 실패했습니다.');
    return res.json();
  },
  async update(id: string, data: Partial<{ name: string; config: Record<string, unknown>; isShared: boolean; isDefault: boolean }>): Promise<SavedView> {
    const res = await fetch(`${API_BASE_URL}/api/views/${id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!res.ok) await throwApiError(res, '뷰 수정에 실패했습니다.');
    return res.json();
  },
  async remove(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/views/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!res.ok) await throwApiError(res, '뷰 삭제에 실패했습니다.');
  },
};
