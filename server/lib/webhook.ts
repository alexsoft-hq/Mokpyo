// 자동화 '웹훅 보내기' 액션. SSRF 방지(사설망·localhost 차단, DNS 해석 결과까지 검사) + HMAC 서명 + 5초 타임아웃.
import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
];

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return PRIVATE_V4.some((re) => re.test(ip));
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7)); // v4-mapped
    return false;
  }
  return true; // IP 형식이 아니면 안전하지 않다고 본다
}

const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.localhost', '.home', '.lan'];

/** URL 형식·스킴·호스트명 수준의 정적 검사(규칙 저장 시 사용). */
export function validateWebhookUrl(raw: string, env: NodeJS.ProcessEnv = process.env): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return '올바른 URL 이 아닙니다.';
  }
  const allowHttp = env.NODE_ENV !== 'production' || env.WEBHOOK_ALLOW_HTTP === 'true';
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
    return '웹훅 URL 은 https:// 로 시작해야 합니다.';
  }
  if (url.username || url.password) return 'URL 에 인증 정보를 넣을 수 없습니다.';
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return '내부 네트워크 주소로는 웹훅을 보낼 수 없습니다.';
  }
  if (net.isIP(host) && isPrivateAddress(host)) {
    return '내부 네트워크 주소로는 웹훅을 보낼 수 없습니다.';
  }
  return null;
}

/** 실행 시점 검사: DNS 해석 결과가 사설망이면 거부(DNS 리바인딩·내부 호스트명 우회 방지). */
export async function assertResolvesToPublic(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('내부 네트워크 주소로는 웹훅을 보낼 수 없습니다.');
    return;
  }
  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0) throw new Error('웹훅 호스트를 찾을 수 없습니다.');
  if (records.some((r) => isPrivateAddress(r.address))) {
    throw new Error('내부 네트워크 주소로는 웹훅을 보낼 수 없습니다.');
  }
}

export function signPayload(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export interface WebhookDelivery {
  url: string;
  secret?: string;
  event: string;
  deliveryId: string;
  payload: unknown;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** 페이로드를 POST 한다. 2xx 가 아니면 예외(자동화 실행 로그에 FAILED 로 남는다). */
export async function sendWebhook(d: WebhookDelivery): Promise<{ status: number }> {
  const invalid = validateWebhookUrl(d.url);
  if (invalid) throw new Error(invalid);
  await assertResolvesToPublic(new URL(d.url).hostname);

  const body = JSON.stringify(d.payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mokpyo-Webhook/1.0',
    'X-Mokpyo-Event': d.event,
    'X-Mokpyo-Delivery': d.deliveryId,
  };
  if (d.secret) headers['X-Mokpyo-Signature'] = signPayload(d.secret, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), d.timeoutMs ?? 5000);
  try {
    const res = await (d.fetchImpl ?? fetch)(d.url, { method: 'POST', headers, body, signal: controller.signal, redirect: 'manual' });
    if (res.status < 200 || res.status >= 300) throw new Error(`웹훅 응답 ${res.status}`);
    return { status: res.status };
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('웹훅 응답 시간 초과(5초)');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
