// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '@/i18n';
import { mcpApi, type McpConnections } from '@/lib/api/mcp';
import { McpConnectionsCard } from './McpConnectionsCard';

vi.mock('@/lib/api/mcp', () => ({ mcpApi: { connections: vi.fn(), revoke: vi.fn() } }));
const data: McpConnections = { endpoint: 'https://mokpyo.example.test/mcp', connections: [{
  id: 'connection-1', name: 'Claude', scopes: ['mokpyo:read'], createdAt: '2026-01-01T00:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z', lastUsedAt: null, revokedAt: null,
}] };
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(mcpApi.connections).mockResolvedValue(data);
  vi.mocked(mcpApi.revoke).mockResolvedValue(undefined);
  await setLanguage('en');
});
afterEach(async () => { cleanup(); await setLanguage('ko'); });

describe('MCP connections', () => {
  it('copies the provided endpoint and revokes only the selected connection in its workspace', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<McpConnectionsCard orgId="org-1" />);
    await screen.findByText('Claude');
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy MCP server address' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(data.endpoint));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Claude connection' }));
    await screen.findByText('Revoked');
    expect(mcpApi.revoke).toHaveBeenCalledWith('org-1', 'connection-1', expect.any(AbortSignal));
    expect(screen.queryByRole('button', { name: 'Revoke Claude connection' })).not.toBeInTheDocument();
    await act(async () => { await setLanguage('ko'); });
    expect(screen.getByText('해제됨')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('does not display old workspace connections while the next workspace loads', async () => {
    let resolveOld!: (value: McpConnections) => void;
    vi.mocked(mcpApi.connections).mockImplementation(id => id === 'org-1' ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ endpoint: 'https://mokpyo.example.test/mcp', connections: [] }));
    const { rerender } = render(<McpConnectionsCard orgId="org-1" />);
    rerender(<McpConnectionsCard orgId="org-2" />);
    await screen.findByText('You have not authorized any AI connections for this workspace.');
    await act(async () => { resolveOld(data); });
    expect(screen.queryByText('Claude')).not.toBeInTheDocument();
    expect(mcpApi.connections).toHaveBeenLastCalledWith('org-2', expect.any(AbortSignal));
  });

  it('keeps a failed revoke visible without claiming revocation', async () => {
    vi.mocked(mcpApi.revoke).mockRejectedValue(new Error('Server unavailable'));
    render(<McpConnectionsCard orgId="org-1" />);
    await screen.findByText('Claude');
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Claude connection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    expect(screen.queryByText('Revoked')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke Claude connection' })).toBeEnabled();
  });
});
