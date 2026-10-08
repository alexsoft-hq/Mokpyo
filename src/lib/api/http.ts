// Shared HTTP helpers for all API modules.
// Extracted from src/lib/api.ts so new feature API modules (fields, comments,
// automations, views, dashboards) can reuse the exact same auth/parse/error logic.

// API 기본 URL 설정
export const getApiBaseUrl = (): string => {
  // 환경변수로 API URL이 지정된 경우
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // VITE_BASE_URL을 고려하여 API 경로 설정
  const baseUrl = import.meta.env.BASE_URL || '/';

  // 개발 모드: Vite proxy 사용 (BASE_URL 고려)
  if (import.meta.env.DEV) {
    return baseUrl === '/' ? '' : baseUrl.replace(/\/$/, '');
  }

  // 프로덕션: 현재 브라우저와 같은 호스트/포트 사용 (BASE_URL 고려)
  return baseUrl === '/' ? '' : baseUrl.replace(/\/$/, '');
};

export const API_BASE_URL = getApiBaseUrl();

// Helper to get auth headers
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const orgId = localStorage.getItem('currentOrganizationId');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (orgId) {
    headers['X-Organization-Id'] = orgId;
  }
  return headers;
}

// Helper to safely parse JSON response (handles HTML error pages from nginx)
export async function safeJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('Non-JSON response:', text.slice(0, 200));
    throw new Error(fallbackMessage);
  }
}

// Error carrying the HTTP status + parsed server payload, so callers (e.g. the
// table inline-edit 409 flow) can branch on status and read currentData.
export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Helper to throw API error with safe JSON parsing
export async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(`${fallbackMessage} (서버 응답: ${response.status})`, response.status, null);
  }
  const message =
    parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error: unknown }).error === 'string'
      ? (parsed as { error: string }).error
      : fallbackMessage;
  throw new ApiError(message, response.status, parsed);
}

// --- 세션 만료 처리 -----------------------------------------------------------
// 토큰이 만료되면 서버가 401(TOKEN_INVALID)을 준다. 화면마다 처리하지 않고 한 곳에서 잡아
// 'mokpyo:unauthorized' 이벤트를 쏘면 AuthContext 가 로그아웃 + 로그인 화면으로 보낸다.
export const UNAUTHORIZED_EVENT = 'mokpyo:unauthorized';
const PUBLIC_AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/verify-email', '/api/auth/resend-verification', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/config'];

let interceptorInstalled = false;
export function installUnauthorizedInterceptor(): void {
  if (interceptorInstalled || typeof window === 'undefined') return;
  interceptorInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0];
      const isApi = path.includes('/api/') && !PUBLIC_AUTH_PATHS.some((p) => path.endsWith(p));
      if (response.status === 401 && isApi && localStorage.getItem('auth_token')) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
    } catch {
      // URL 해석 실패는 무시 — 응답은 그대로 돌려준다.
    }
    return response;
  };
}
