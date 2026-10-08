// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completeMcpRedirect, mcpApi, rememberMcpLoginReturn, safeMcpReturnPath, takeMcpLoginReturn } from './mcp';

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.mocked(localStorage.getItem).mockImplementation(key => key === 'auth_token' ? 'test-token' : key === 'currentOrganizationId' ? 'unrelated-workspace' : null);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ endpoint: '/mcp', connections: [] }), { status: 200 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('MCP client API scoping', () => {
  it('sends JWT-only consent requests without the selected workspace header', async () => {
    await mcpApi.consent('opaque/id');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/api/mcp/consent/opaque%2Fid');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(new Headers(init?.headers).has('X-Organization-Id')).toBe(false);
  });
  it('uses the explicit consent workspace and only the supplied scopes', async () => {
    await mcpApi.decide('request', { organizationId: 'chosen', scopes: ['mokpyo:read'], approved: true });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({ organizationId: 'chosen', scopes: ['mokpyo:read'], approved: true });
    expect(new Headers(init?.headers).has('X-Organization-Id')).toBe(false);
  });
  it('binds connection listing and revocation to the displayed workspace', async () => {
    await mcpApi.connections('displayed');
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get('X-Organization-Id')).toBe('displayed');
    await mcpApi.revoke('displayed', 'connection/id');
    const [url, init] = vi.mocked(fetch).mock.calls[1];
    expect(url).toContain('/api/mcp/connections/connection%2Fid');
    expect(init?.method).toBe('DELETE');
    expect(new Headers(init?.headers).get('X-Organization-Id')).toBe('displayed');
  });
});

describe('MCP sign-in return routing', () => {
  it('accepts only a local consent route and canonicalizes its request query', () => {
    expect(safeMcpReturnPath('/connect/mcp?request=a%26b&redirect=https://evil.test')).toBe('/connect/mcp?request=a%26b');
    for (const value of ['https://evil.test/connect/mcp?request=a', '//evil.test', '/invite/a', '/connect/mcp?request=', '/connect/mcp/../other?request=a', 'javascript:alert(1)']) {
      expect(safeMcpReturnPath(value)).toBeNull();
    }
  });
  it('consumes a scoped return once and clears it for an unrelated Google flow', () => {
    rememberMcpLoginReturn('/connect/mcp?request=opaque');
    expect(takeMcpLoginReturn()).toBe('/connect/mcp?request=opaque');
    expect(takeMcpLoginReturn()).toBeNull();
    rememberMcpLoginReturn('/connect/mcp?request=opaque');
    rememberMcpLoginReturn('/invite/example');
    expect(takeMcpLoginReturn()).toBeNull();
  });
  it('expires pending Google returns', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    rememberMcpLoginReturn('/connect/mcp?request=opaque');
    vi.spyOn(Date, 'now').mockReturnValue(now + 600_001);
    expect(takeMcpLoginReturn()).toBeNull();
  });
  it('rejects unsafe callback schemes and mismatched hosts before navigation', () => {
    expect(() => completeMcpRedirect('javascript:alert(1)', 'claude.ai')).toThrow();
    expect(() => completeMcpRedirect('https://evil.test/callback', 'claude.ai')).toThrow();
    expect(() => completeMcpRedirect('http://claude.ai/callback', 'claude.ai')).toThrow();
    expect(() => completeMcpRedirect('https://user:password@claude.ai/callback', 'claude.ai')).toThrow();
  });
});
