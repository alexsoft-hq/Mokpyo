import { t } from '@/i18n';
import { Goal, GoalCategory, Attachment, Project } from '@/types/goal';
import { ActivityLog } from '@/types/activity';
import { ReportTemplate, AIReportRequest, AIReportResponse, AISummarizeResponse } from '@/types/ai';
import { API_BASE_URL, getAuthHeaders, safeJson, throwApiError, localizeApiError } from '@/lib/api/http';

export { API_BASE_URL, getAuthHeaders, safeJson, throwApiError, ApiError } from '@/lib/api/http';

interface CategoryWithId {
  id: string;
  name: string;
  color: string;
}

export const api = {
  // Auth
  async register(email: string, password: string, name: string): Promise<{ message: string; email: string; token?: string; user?: { userId: string; email: string; name: string; picture?: string } }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(localizeApiError(data.error, t("회원가입에 실패했습니다.")));
    }
    return response.json();
  },

  async verifyEmail(email: string, code: string): Promise<{ token: string; user: { userId: string; email: string; name: string; picture?: string } }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(localizeApiError(data.error, t("이메일 인증에 실패했습니다.")));
    }
    return response.json();
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(localizeApiError(data.error, t("인증 코드 재발송에 실패했습니다.")));
    }
    return response.json();
  },

  async login(email: string, password: string): Promise<{ token: string; user: { userId: string; email: string; name: string; picture?: string } }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const data = await response.json();
      const error: any = new Error(localizeApiError(data.error, t("로그인에 실패했습니다.")));
      if (data.needsVerification) {
        error.needsVerification = true;
        error.email = data.email;
      }
      throw error;
    }
    return response.json();
  },

  // 비밀번호 재설정 요청. 계정 존재 여부와 무관하게 서버는 항상 같은 문구를 돌려준다.
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(localizeApiError(data.error, t("비밀번호 재설정 요청에 실패했습니다.")));
    }
    return response.json();
  },

  async validateResetToken(token: string): Promise<{ valid: boolean }> {
    const response = await fetch(
      `${API_BASE_URL}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(localizeApiError(data.error, t("링크를 확인할 수 없습니다.")));
    }
    return response.json();
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(localizeApiError(data.error, t("비밀번호 재설정에 실패했습니다.")));
    }
    return response.json();
  },

  // Profile
  async updateProfile(name: string): Promise<{ user: { userId: string; email: string; name: string; picture?: string } }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      await throwApiError(response, t("프로필 수정에 실패했습니다."));
    }
    return safeJson(response, t("프로필 수정 응답을 처리할 수 없습니다."));
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      await throwApiError(response, t("비밀번호 변경에 실패했습니다."));
    }
    return safeJson(response, t("비밀번호 변경 응답을 처리할 수 없습니다."));
  },

  async selectDefaultAvatar(avatarId: string): Promise<{ user: { userId: string; email: string; name: string; picture?: string } }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/default-avatar`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ avatarId }),
    });
    if (!response.ok) {
      await throwApiError(response, t("아바타 설정에 실패했습니다."));
    }
    return safeJson(response, t("아바타 설정 응답을 처리할 수 없습니다."));
  },

  async uploadProfilePicture(file: File): Promise<{ user: { userId: string; email: string; name: string; picture?: string } }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('auth_token');
    const orgId = localStorage.getItem('currentOrganizationId');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (orgId) {
      headers['X-Organization-Id'] = orgId;
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/profile-picture`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      await throwApiError(response, t("프로필 사진 업로드에 실패했습니다."));
    }
    return safeJson(response, t("프로필 사진 업로드 응답을 처리할 수 없습니다."));
  },

  getProfilePictureUrl(fileName: string): string {
    return `${API_BASE_URL}/api/auth/profile-picture/${fileName}`;
  },

  // Users
  async getUsers(): Promise<{ id: string; name: string; picture: string | null }[]> {
    const response = await fetch(`${API_BASE_URL}/api/users`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  // Projects
  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/api/projects`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  },

  async createProject(project: { name: string; description?: string; dashboardTitle?: string; dashboardSubtitle?: string; parentId?: string | null }): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(project),
    });
    if (!response.ok) throw new Error('Failed to create project');
    return response.json();
  },

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(project),
    });
    if (!response.ok) throw new Error('Failed to update project');
    return response.json();
  },

  async deleteProject(id: string, confirmName: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ confirmName }),
    });
    if (!response.ok) {
      await throwApiError(response, t("프로젝트 삭제에 실패했습니다."));
    }
  },

  // Categories
  async getCategories(projectId: string, includeDescendants: boolean = false): Promise<CategoryWithId[]> {
    const response = await fetch(`${API_BASE_URL}/api/categories?projectId=${projectId}&includeDescendants=${includeDescendants}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
  },

  async createCategory(name: string, color: string, projectId: string): Promise<CategoryWithId> {
    const response = await fetch(`${API_BASE_URL}/api/categories`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, color, projectId }),
    });
    if (!response.ok) throw new Error('Failed to create category');
    return response.json();
  },

  async updateCategoryColor(id: string, color: string): Promise<CategoryWithId> {
    const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ color }),
    });
    if (!response.ok) throw new Error('Failed to update category');
    return response.json();
  },

  async updateCategoryName(id: string, name: string): Promise<CategoryWithId> {
    const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to update category');
    return response.json();
  },

  async deleteCategory(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete category');
  },

  // Goals
  async getGoals(projectId: string, showCompleted: boolean = false, includeDescendants: boolean = false, showOnHold: boolean = true, lightweight: boolean = false, completedDateFrom?: string, completedDateTo?: string): Promise<Goal[]> {
    let url = `${API_BASE_URL}/api/goals?projectId=${projectId}&showCompleted=${showCompleted}&includeDescendants=${includeDescendants}&showOnHold=${showOnHold}${lightweight ? '&lightweight=true' : ''}`;
    if (completedDateFrom) url += `&completedDateFrom=${completedDateFrom}`;
    if (completedDateTo) url += `&completedDateTo=${completedDateTo}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch goals');
    return response.json();
  },

  async getGoal(id: string): Promise<Goal> {
    const response = await fetch(`${API_BASE_URL}/api/goals/${id}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch goal');
    return response.json();
  },

  async createGoal(goal: Goal): Promise<Goal> {
    const response = await fetch(`${API_BASE_URL}/api/goals`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(goal),
    });
    if (!response.ok) throw new Error('Failed to create goal');
    return response.json();
  },

  async updateGoal(id: string, goal: Goal): Promise<Goal> {
    const response = await fetch(`${API_BASE_URL}/api/goals/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(goal),
    });
    if (!response.ok) {
      const error: any = new Error('Failed to update goal');
      error.response = { status: response.status, data: await response.json() };
      throw error;
    }
    return response.json();
  },

  async deleteGoal(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/goals/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete goal');
  },

  async reorderGoals(goals: { id: string; order: number }[]): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/goals/reorder`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ goals }),
    });
    if (!response.ok) throw new Error('Failed to reorder goals');
  },

  async toggleGoalCompletion(id: string, completed: boolean): Promise<Goal> {
    const response = await fetch(`${API_BASE_URL}/api/goals/${id}/complete`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ completed }),
    });
    if (!response.ok) throw new Error('Failed to toggle goal completion');
    return response.json();
  },

  async toggleGoalOnHold(id: string, onHold: boolean): Promise<Goal> {
    const response = await fetch(`${API_BASE_URL}/api/goals/${id}/hold`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ onHold }),
    });
    if (!response.ok) throw new Error('Failed to toggle goal on-hold status');
    return response.json();
  },

  async copyGoal(id: string, targetProjectId: string): Promise<{
    goal: Goal;
    categoryMapping: Record<string, { targetId: string; isNew: boolean; name: string }>;
    sourceProject: string;
    targetProject: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/goals/${id}/copy`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ targetProjectId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to copy goal');
    }
    return response.json();
  },

  // Settings
  async getSettings(): Promise<{ dashboardTitle: string; dashboardSubtitle: string }> {
    const response = await fetch(`${API_BASE_URL}/api/settings`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  },

  async updateSettings(settings: { dashboardTitle?: string; dashboardSubtitle?: string }): Promise<Record<string, string>> {
    const response = await fetch(`${API_BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to update settings');
    return response.json();
  },

  // Attachments
  async uploadAttachment(goalId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('auth_token');
    const orgId = localStorage.getItem('currentOrganizationId');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (orgId) {
      headers['X-Organization-Id'] = orgId;
    }

    const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}/attachments`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload attachment');
    return response.json();
  },

  async getAttachments(goalId: string): Promise<Attachment[]> {
    const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}/attachments`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch attachments');
    return response.json();
  },

  async downloadAttachment(attachmentId: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const orgId = localStorage.getItem('currentOrganizationId');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (orgId) {
      headers['X-Organization-Id'] = orgId;
    }

    const response = await fetch(`${API_BASE_URL}/api/attachments/${attachmentId}/download`, { headers });
    if (!response.ok) throw new Error('Failed to download attachment');

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    const filenameMatch = contentDisposition?.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'download';

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete attachment');
  },

  // Activity Log
  async getActivityFeed(projectId?: string, limit = 50, offset = 0): Promise<ActivityLog[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    params.append('limit', String(limit));
    params.append('offset', String(offset));

    const response = await fetch(`${API_BASE_URL}/api/activity?${params.toString()}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch activity feed');
    return response.json();
  },

  async getGoalActivity(goalId: string, limit = 50, offset = 0): Promise<ActivityLog[]> {
    const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}/activity?limit=${limit}&offset=${offset}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch goal activity');
    return response.json();
  },

  // AI
  async getAIStatus(): Promise<{ available: boolean }> {
    const response = await fetch(`${API_BASE_URL}/api/ai/status`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch AI status');
    return response.json();
  },

  async generateReportStream(
    request: AIReportRequest,
    onChunk: (text: string) => void,
    onMetadata: (metadata: AIReportResponse['metadata']) => void,
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/ai/report`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      await throwApiError(response, t("리포트 생성에 실패했습니다."));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error(t("스트리밍을 지원하지 않습니다."));

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === 'chunk') onChunk(data.content);
          else if (data.type === 'metadata') onMetadata(data.metadata);
          else if (data.type === 'error') throw new Error(data.error);
        } catch (e) {
          if (e instanceof Error && e.message !== trimmed.slice(6)) throw e;
        }
      }
    }
  },

  async summarizeActivityStream(
    activityIds: string[],
    onChunk: (text: string) => void,
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/ai/summarize-activity`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ activityIds }),
    });
    if (!response.ok) {
      await throwApiError(response, t("AI 요약에 실패했습니다."));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error(t("스트리밍을 지원하지 않습니다."));

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === 'chunk') onChunk(data.content);
          else if (data.type === 'error') throw new Error(data.error);
        } catch (e) {
          if (e instanceof Error && e.message !== trimmed.slice(6)) throw e;
        }
      }
    }
  },

  // Report Templates
  async getReportTemplates(projectId?: string): Promise<ReportTemplate[]> {
    const params = projectId ? `?projectId=${projectId}` : '';
    const response = await fetch(`${API_BASE_URL}/api/report-templates${params}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch report templates');
    return response.json();
  },

  async uploadReportTemplate(formData: FormData): Promise<ReportTemplate> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/report-templates`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      await throwApiError(response, t("템플릿 업로드에 실패했습니다."));
    }
    return safeJson(response, t("템플릿 업로드 응답을 처리할 수 없습니다."));
  },

  async deleteReportTemplate(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/report-templates/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete report template');
  },

  // Organizations
  async getOrganizations(): Promise<Organization[]> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/organizations`, {
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error('Failed to fetch organizations');
    return response.json();
  },

  async createOrganization(name: string): Promise<Organization> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      await throwApiError(response, t("워크스페이스 생성에 실패했습니다."));
    }
    return response.json();
  },

  async getOrganization(id: string): Promise<Organization> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/organizations/${id}`, {
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error('Failed to fetch organization');
    return response.json();
  },

  async updateOrganization(id: string, data: { name?: string; slug?: string }): Promise<Organization> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/organizations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update organization');
    return response.json();
  },

  async deleteOrganization(id: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/organizations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error('Failed to delete organization');
  },

  // Organization Members
  async getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/members`, {
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error('Failed to fetch members');
    return response.json();
  },

  async updateMemberRole(orgId: string, userId: string, role: string): Promise<OrganizationMember> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/members/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      await throwApiError(response, t("역할 변경에 실패했습니다."));
    }
    return response.json();
  },

  async removeMember(orgId: string, userId: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) {
      await throwApiError(response, t("멤버 제거에 실패했습니다."));
    }
  },

  // Invitations
  async createInvitation(organizationId: string, email: string, role: string = 'MEMBER'): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ organizationId, email, role }),
    });
    if (!response.ok) {
      await throwApiError(response, t("초대 생성에 실패했습니다."));
    }
    return response.json();
  },

  async getInvitation(token: string): Promise<InvitationInfo> {
    const response = await fetch(`${API_BASE_URL}/api/invitations/${token}`);
    if (!response.ok) {
      await throwApiError(response, t("초대 정보를 불러올 수 없습니다."));
    }
    return response.json();
  },

  async acceptInvitation(inviteToken: string): Promise<{ organizationId: string; organizationName: string; role?: string }> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/invitations/${inviteToken}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) {
      await throwApiError(response, t("초대 수락에 실패했습니다."));
    }
    return response.json();
  },

  async cancelInvitation(id: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/invitations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error('Failed to cancel invitation');
  },

  async getPendingInvitations(orgId: string): Promise<PendingInvitation[]> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/invitations/org/${orgId}`, {
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new Error('Failed to fetch invitations');
    return response.json();
  },

  async leaveOrganization(orgId: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) {
      await throwApiError(response, t("워크스페이스 나가기에 실패했습니다."));
    }
  },

  // Check-ins (목표 진행 추이)
  async getCheckIns(goalId: string): Promise<CheckIn[]> {
    const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}/check-ins`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch check-ins');
    return response.json();
  },

  // Cycles (목표 주기 / 분기 OKR)
  async getCycles(): Promise<Cycle[]> {
    const response = await fetch(`${API_BASE_URL}/api/cycles`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch cycles');
    return response.json();
  },

  async createCycle(data: { name: string; type?: string; startDate: string; endDate: string }): Promise<Cycle> {
    const response = await fetch(`${API_BASE_URL}/api/cycles`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) await throwApiError(response, t("사이클 생성에 실패했습니다."));
    return response.json();
  },

  async updateCycle(id: string, data: { name?: string; type?: string; startDate?: string; endDate?: string }): Promise<Cycle> {
    const response = await fetch(`${API_BASE_URL}/api/cycles/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) await throwApiError(response, t("사이클 수정에 실패했습니다."));
    return response.json();
  },

  async deleteCycle(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/cycles/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) await throwApiError(response, t("사이클 삭제에 실패했습니다."));
  },

  /** 사이클 기간과 겹치는 미배정 목표 미리보기 (OWNER/ADMIN) */
  async getCycleUnassignedOverlaps(cycleId: string): Promise<CycleOverlapPreview> {
    const response = await fetch(`${API_BASE_URL}/api/cycles/${cycleId}/unassigned-overlaps`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) await throwApiError(response, t("배정 대상 목표 조회에 실패했습니다."));
    return response.json();
  },

  /** 사이클 기간과 겹치는 미배정 목표 일괄 배정 (OWNER/ADMIN). goalIds = 미리보기에서 확인한 목록 */
  async assignCycleOverlaps(cycleId: string, goalIds: string[]): Promise<{ assigned: number }> {
    const response = await fetch(`${API_BASE_URL}/api/cycles/${cycleId}/assign-overlaps`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ goalIds }),
    });
    if (!response.ok) await throwApiError(response, t("목표 일괄 배정에 실패했습니다."));
    return response.json();
  },

  // Notifications (X-Organization-Id 필요 → getAuthHeaders 사용)
  async getNotifications(limit = 30): Promise<AppNotification[]> {
    const response = await fetch(`${API_BASE_URL}/api/notifications?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },

  async getUnreadNotificationCount(): Promise<number> {
    const response = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch unread count');
    const data = await response.json();
    return data.count ?? 0;
  },

  async markNotificationRead(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to mark notification read');
  },

  async markAllNotificationsRead(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to mark all notifications read');
  },
};

// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
  projectCount: number;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  picture: string | null;
  role: string;
  createdAt: string;
}

export interface InvitationInfo {
  id: string;
  email: string;
  role: string;
  organization: { id: string; name: string; slug: string };
  invitedBy: string;
  expiresAt: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface Cycle {
  id: string;
  organizationId: string;
  name: string;
  type: string; // quarter | half | annual | custom
  startDate: string; // YYYY-MM-DD
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CycleOverlapPreview {
  count: number;
  goals: {
    id: string;
    title: string;
    startDate: string | null;
    dueDate: string | null;
    projectName: string;
  }[];
}

export interface CheckIn {
  id: string;
  goalId: string;
  userId: string | null;
  progress: number;
  confidence: string | null;
  note: string | null;
  createdAt: string;
  user?: { name: string } | null;
}

// 알림 (DOM 전역 Notification과 충돌 피하려 AppNotification)
export interface AppNotification {
  id: string;
  organizationId: string;
  recipientId: string;
  actorId: string | null;
  actorName: string | null;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}
