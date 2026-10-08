import { t } from '@/i18n';
import { API_BASE_URL, getAuthHeaders, throwApiError } from '@/lib/api/http';

export interface CommentAuthor {
  id: string;
  name: string;
  picture: string | null;
}

export interface Comment {
  id: string;
  goalId: string;
  authorId: string | null;
  authorName: string;
  author: CommentAuthor | null;
  parentId: string | null;
  body: string;
  deleted: boolean;
  editedAt: string | null;
  createdAt: string;
  replies?: Comment[];
}

export const commentsApi = {
  async list(goalId: string): Promise<Comment[]> {
    const res = await fetch(`${API_BASE_URL}/api/goals/${goalId}/comments`, { headers: getAuthHeaders() });
    if (!res.ok) await throwApiError(res, t("댓글을 불러오지 못했습니다."));
    return res.json();
  },
  async create(goalId: string, body: string, parentId?: string): Promise<Comment> {
    const res = await fetch(`${API_BASE_URL}/api/goals/${goalId}/comments`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ body, parentId }),
    });
    if (!res.ok) await throwApiError(res, t("댓글 작성에 실패했습니다."));
    return res.json();
  },
  async update(goalId: string, id: string, body: string): Promise<Comment> {
    const res = await fetch(`${API_BASE_URL}/api/goals/${goalId}/comments/${id}`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ body }),
    });
    if (!res.ok) await throwApiError(res, t("댓글 수정에 실패했습니다."));
    return res.json();
  },
  async remove(goalId: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/goals/${goalId}/comments/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    if (!res.ok) await throwApiError(res, t("댓글 삭제에 실패했습니다."));
  },
};
