import { t } from '@/i18n';
import { API_BASE_URL, getAuthHeaders, safeJson, throwApiError } from './http';

export type McpScope = 'mokpyo:read' | 'mokpyo:write';
export interface McpConsentRequest {
  clientName: string;
  redirectHost: string;
  requestedScopes: string[];
  expiresAt: string;
}
export interface McpConnection {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
export interface McpConnections {
  connections: McpConnection[];
  endpoint: string;
}

function headers(organizationId?: string): Headers {
  const result = new Headers(getAuthHeaders());
  // Consent chooses a workspace explicitly; it must not inherit the current one.
  result.delete('X-Organization-Id');
  if (organizationId) result.set('X-Organization-Id', organizationId);
  return result;
}

export const mcpApi = {
  async consent(requestId: string, signal?: AbortSignal): Promise<McpConsentRequest> {
    const response = await fetch(`${API_BASE_URL}/api/mcp/consent/${encodeURIComponent(requestId)}`, { headers: headers(), signal });
    if (!response.ok) await throwApiError(response, 'AI 연결 요청을 불러오지 못했습니다.');
    return safeJson(response, 'AI 연결 응답을 읽을 수 없습니다.');
  },
  async decide(requestId: string, decision: { organizationId: string; scopes: McpScope[]; approved: boolean }, signal?: AbortSignal): Promise<{ redirectUrl: string }> {
    const response = await fetch(`${API_BASE_URL}/api/mcp/consent/${encodeURIComponent(requestId)}`, {
      method: 'POST', headers: headers(), body: JSON.stringify(decision), signal,
    });
    if (!response.ok) await throwApiError(response, 'AI 연결 요청을 처리하지 못했습니다.');
    return safeJson(response, 'AI 연결 응답을 읽을 수 없습니다.');
  },
  async connections(organizationId: string, signal?: AbortSignal): Promise<McpConnections> {
    const response = await fetch(`${API_BASE_URL}/api/mcp/connections`, { headers: headers(organizationId), signal });
    if (!response.ok) await throwApiError(response, 'AI 연결 목록을 불러오지 못했습니다.');
    return safeJson(response, 'AI 연결 응답을 읽을 수 없습니다.');
  },
  async revoke(organizationId: string, id: string, signal?: AbortSignal): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/mcp/connections/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: headers(organizationId), signal,
    });
    if (!response.ok) await throwApiError(response, 'AI 연결을 해제하지 못했습니다.');
  },
};

export function mcpConsentPath(requestId: string): string {
  return `/connect/mcp?request=${encodeURIComponent(requestId)}`;
}

/** Only the local MCP consent route can be resumed after Google sign-in. */
export function safeMcpReturnPath(value: string | null): string | null {
  if (!value?.startsWith('/connect/mcp?')) return null;
  try {
    const url = new URL(value, 'https://mokpyo.invalid');
    const requestId = url.searchParams.get('request');
    if (url.origin !== 'https://mokpyo.invalid' || url.pathname !== '/connect/mcp' || !requestId || requestId.length > 1024) return null;
    return mcpConsentPath(requestId);
  } catch { return null; }
}

const RETURN_KEY = 'mokpyo.mcpLoginReturn';
export function rememberMcpLoginReturn(value: string): void {
  const path = safeMcpReturnPath(value);
  try {
    sessionStorage.removeItem(RETURN_KEY);
    if (path) sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path, savedAt: Date.now() }));
  } catch { /* Optional storage. */ }
}
export function takeMcpLoginReturn(): string | null {
  try {
    const stored = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    if (!stored) return null;
    const value = JSON.parse(stored);
    if (typeof value.savedAt !== 'number' || Date.now() - value.savedAt > 10 * 60 * 1000 || value.savedAt > Date.now()) return null;
    return safeMcpReturnPath(value.path);
  } catch { return null; }
}

/** The server validates registered redirects; also reject unsafe browser schemes. */
export function completeMcpRedirect(value: string, expectedHost: string): void {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.host !== expectedHost || url.username || url.password) {
    throw new Error(t('AI 연결의 반환 주소를 확인할 수 없습니다.'));
  }
  window.location.assign(url.href);
}
