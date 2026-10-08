// 계정 자체 작업: 내 데이터 내보내기, 계정 삭제.
import { API_BASE_URL, getAuthHeaders, throwApiError } from '@/lib/api/http';
import { triggerDownload } from '@/lib/api/organizations';

export async function downloadAccountExport(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/auth/account/export`, { headers: getAuthHeaders() });
  if (!response.ok) await throwApiError(response, '내보내기에 실패했습니다.');
  const filename = `mokpyo-account-${new Date().toISOString().slice(0, 10)}.json`;
  triggerDownload(await response.blob(), filename);
  return filename;
}

export async function deleteAccount(body: { password?: string; confirmEmail?: string }): Promise<{ success: boolean; deletedWorkspaces: number }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/account`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) await throwApiError(response, '계정 삭제에 실패했습니다.');
  return response.json();
}
