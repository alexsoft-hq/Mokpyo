// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '@/i18n';
import { completeMcpRedirect, mcpApi } from '@/lib/api/mcp';
import McpConsent from './McpConsent';

const state = vi.hoisted(() => ({ authenticated: true, loading: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({
  isAuthenticated: state.authenticated, isLoading: state.loading,
  user: state.authenticated ? { userId: 'user-1', name: 'Sam Rivera', email: 'sam@example.test' } : null,
}) }));
vi.mock('@/contexts/WorkspaceContext', () => ({ useWorkspace: () => ({
  organizations: [{ id: 'org-1', name: 'Operations' }, { id: 'org-2', name: '연구팀' }],
  currentOrganization: { id: 'org-1', name: 'Operations' }, isLoading: false,
}) }));
vi.mock('@/lib/api/mcp', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/api/mcp')>(),
  mcpApi: { consent: vi.fn(), decide: vi.fn() }, completeMcpRedirect: vi.fn(),
}));
const request = {
  clientName: 'Claude', redirectHost: 'claude.ai', requestedScopes: ['mokpyo:read', 'mokpyo:write'],
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
};
function mount(path = '/connect/mcp?request=request-1') {
  return render(<MemoryRouter initialEntries={[path]}><McpConsent /><Link to="/connect/mcp?request=request-2">Another request</Link></MemoryRouter>);
}

beforeEach(async () => {
  vi.clearAllMocks(); state.authenticated = true; state.loading = false;
  vi.mocked(mcpApi.consent).mockResolvedValue(request);
  vi.mocked(mcpApi.decide).mockResolvedValue({ redirectUrl: 'https://claude.ai/callback?code=example' });
  await setLanguage('en');
});
afterEach(async () => { cleanup(); await setLanguage('ko'); });

describe('MCP consent', () => {
  it('never loads or approves an unauthenticated request and preserves only its local return route', () => {
    state.authenticated = false;
    mount('/connect/mcp?request=opaque%26value');
    expect(screen.getByRole('link', { name: 'Sign in to review connection' })).toHaveAttribute('href', '/login?redirect=%2Fconnect%2Fmcp%3Frequest%3Dopaque%2526value');
    expect(mcpApi.consent).not.toHaveBeenCalled();
    expect(mcpApi.decide).not.toHaveBeenCalled();
  });

  it('defaults to read-only and submits the chosen workspace only after an explicit click', async () => {
    mount();
    await screen.findByText('Claude');
    expect(screen.getByText('Sam Rivera')).toBeInTheDocument();
    expect(screen.getByText('(sam@example.test)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Read access/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Read access/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Allow goal/ })).not.toBeChecked();
    expect(mcpApi.decide).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Workspace to connect'), { target: { value: 'org-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Allow connection' }));
    await waitFor(() => expect(mcpApi.decide).toHaveBeenCalledWith('request-1', { organizationId: 'org-2', scopes: ['mokpyo:read'], approved: true }, expect.any(AbortSignal)));
    expect(completeMcpRedirect).toHaveBeenCalledWith('https://claude.ai/callback?code=example', 'claude.ai');
  });

  it('grants requested write access only when selected, and stays single-submit while pending', async () => {
    vi.mocked(mcpApi.decide).mockImplementation(() => new Promise(() => {}));
    mount();
    await screen.findByText('Claude');
    fireEvent.click(screen.getByRole('checkbox', { name: /Allow goal/ }));
    const button = screen.getByRole('button', { name: 'Allow connection' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mcpApi.decide).toHaveBeenCalledTimes(1);
    expect(mcpApi.decide).toHaveBeenCalledWith('request-1', { organizationId: 'org-1', scopes: ['mokpyo:read', 'mokpyo:write'], approved: true }, expect.any(AbortSignal));
    expect(button).toBeDisabled();
  });

  it('sends explicit denial without optional write access', async () => {
    mount(); await screen.findByText('Claude');
    fireEvent.click(screen.getByRole('checkbox', { name: /Allow goal/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(mcpApi.decide).toHaveBeenCalledWith('request-1', { organizationId: 'org-1', scopes: ['mokpyo:read'], approved: false }, expect.any(AbortSignal)));
  });

  it('keeps failures local and allows retry without redirecting', async () => {
    vi.mocked(mcpApi.decide).mockRejectedValue(new Error('Request failed'));
    mount(); await screen.findByText('Claude');
    fireEvent.click(screen.getByRole('button', { name: 'Allow connection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
    expect(screen.getByRole('button', { name: 'Allow connection' })).toBeEnabled();
    expect(completeMcpRedirect).not.toHaveBeenCalled();
  });

  it('renders client data as text, offers no unrequested write scope and translates UI without changing data', async () => {
    vi.mocked(mcpApi.consent).mockResolvedValue({ ...request, clientName: '<img src=x onerror=alert(1)>', requestedScopes: ['mokpyo:read'] });
    const { container } = mount();
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Allow goal/ })).not.toBeInTheDocument();
    await act(async () => { await setLanguage('ko'); });
    expect(screen.getByRole('button', { name: '연결 허용' })).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });

  it('discards a stale request response after navigation', async () => {
    let resolveOld!: (value: typeof request) => void;
    vi.mocked(mcpApi.consent).mockImplementation(id => id === 'request-1' ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ ...request, clientName: 'Second app' }));
    mount();
    fireEvent.click(screen.getByText('Another request'));
    await screen.findByText('Second app');
    await act(async () => { resolveOld({ ...request, clientName: 'Stale app' }); });
    expect(screen.queryByText('Stale app')).not.toBeInTheDocument();
    expect(screen.getByText('Second app')).toBeInTheDocument();
  });

  it('blocks expired requests', async () => {
    vi.mocked(mcpApi.consent).mockResolvedValue({ ...request, expiresAt: '2000-01-01T00:00:00Z' });
    mount();
    await screen.findByText('Claude');
    expect(screen.getByRole('button', { name: 'Allow connection' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('expired');
    expect(mcpApi.decide).not.toHaveBeenCalled();
  });
});
