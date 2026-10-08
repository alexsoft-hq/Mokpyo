import { t } from '@/i18n';
// 워크스페이스 플랜·사용량·내보내기 API (src/lib/api.ts 의 Organizations 섹션을 보완).
import { API_BASE_URL, getAuthHeaders, safeJson, throwApiError } from '@/lib/api/http';

export type PlanId = 'FREE' | 'PRO' | 'BUSINESS';

export interface OrgBilling {
  plan: PlanId;
  planName: string;
  pricePerSeatKrw: number;
  limits: { members: number | null; projects: number | null; attachmentBytes: number | null };
  features: { automations: boolean; savedViews: boolean; aiReport: boolean; sso: boolean; auditExport: boolean; prioritySupport: boolean };
  usage: { members: number; pendingInvitations: number; projects: number; goals: number; attachmentBytes: number };
  enforced: boolean;
}

export async function getOrganizationBilling(orgId: string): Promise<OrgBilling> {
  const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}`, { headers: getAuthHeaders() });
  if (!response.ok) await throwApiError(response, t("플랜 정보를 불러오지 못했습니다."));
  const data = await safeJson<{ billing: OrgBilling }>(response, t("플랜 정보 응답을 처리할 수 없습니다."));
  return data.billing;
}

/** 워크스페이스 전체 데이터를 JSON 파일로 내려받는다(OWNER/ADMIN). */
export async function downloadOrganizationExport(orgId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/export`, { headers: getAuthHeaders() });
  if (!response.ok) await throwApiError(response, t("내보내기에 실패했습니다."));
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] || `mokpyo-export-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = await response.blob();
  triggerDownload(blob, filename);
  return filename;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
