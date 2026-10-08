import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpActor } from './types';
import { McpError } from './types';

const services = vi.hoisted(() => ({ getCreationContext: vi.fn(), searchGoals: vi.fn(), getGoal: vi.fn(), getReportContext: vi.fn(), previewImport: vi.fn(), previewAppend: vi.fn(), importGoals: vi.fn(), appendSubgoals: vi.fn() }));
vi.mock('./read', async importOriginal => ({ ...await importOriginal<typeof import('./read')>(), getCreationContext: services.getCreationContext, searchGoals: services.searchGoals, getGoal: services.getGoal, getReportContext: services.getReportContext }));
vi.mock('./import', () => ({ previewImport: services.previewImport, previewAppend: services.previewAppend, importGoals: services.importGoals, appendSubgoals: services.appendSubgoals }));
vi.mock('./auth', () => ({ authenticateMcpToken: vi.fn() }));
vi.mock('../lib/prisma', () => ({ prisma: {} }));
vi.mock('./config', () => ({ goalUrl: (id: string) => `https://app.example/?item=${id}`, getMcpUrl: () => 'https://app.example/mcp', getAppUrl: () => 'https://app.example' }));
import { createMcpServer } from './server';

const actor: McpActor = { userId: 'user', userName: 'User', organizationId: 'org', tokenId: 'token', scopes: ['mokpyo:read'] };
const imports = { idempotencyKey: 'request-123', projectId: 'project', goals: [{ title: 'Planned work', categoryIds: ['category'] }] };
const opened: Array<{ client: Client; server: McpServer }> = [];
async function connect(scopes = actor.scopes) {
  const server = createMcpServer({ ...actor, scopes });
  const client = new Client({ name: 'independent-sdk-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  opened.push({ client, server });
  return client;
}
beforeEach(() => {
  vi.resetAllMocks();
  services.searchGoals.mockResolvedValue({ items: [], hasMore: false });
  services.previewImport.mockResolvedValue({ valid: true, writes: false });
  services.importGoals.mockResolvedValue({ replayed: false, goals: [{ id: 'created' }] });
});
afterEach(async () => { for (const { client, server } of opened.splice(0)) { await client.close(); await server.close(); } });

describe('Official SDK discovery and tool calls', () => {
  it('discovers six read-only tools and blocks calling an undiscovered writer', async () => {
    const client = await connect();
    const tools = await client.listTools();
    expect(tools.tools.map(tool => tool.name).sort()).toEqual(['get_creation_context', 'get_goal', 'get_report_context', 'preview_goal_import', 'preview_subgoal_append', 'search_goals']);
    expect(tools.tools.every(tool => tool.annotations?.readOnlyHint === true)).toBe(true);
    const result = await client.callTool({ name: 'import_goals', arguments: imports });
    expect(result.isError).toBe(true);
    expect(services.importGoals).not.toHaveBeenCalled();
  });
  it('advertises write tools only for the write grant and preserves actor isolation', async () => {
    const client = await connect(['mokpyo:read', 'mokpyo:write']);
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(8);
    expect(tools.tools.find(tool => tool.name === 'import_goals')?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
    const result = await client.callTool({ name: 'import_goals', arguments: imports });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ goals: [{ id: 'created', url: 'https://app.example/?item=created' }] });
    expect(services.importGoals).toHaveBeenCalledWith({ ...actor, scopes: ['mokpyo:read', 'mokpyo:write'] }, expect.objectContaining({ idempotencyKey: 'request-123' }));
  });
  it('lets a read-only client preview without reaching the write service', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'preview_goal_import', arguments: imports });
    expect(result.structuredContent).toEqual({ valid: true, writes: false });
    expect(services.previewImport).toHaveBeenCalledWith(actor, expect.objectContaining({ projectId: 'project' }));
    expect(services.importGoals).not.toHaveBeenCalled();
  });
  it('validates tool arguments before a service is called, including injected workspace IDs', async () => {
    const client = await connect();
    for (const args of [{ limit: 51 }, { organizationId: 'other' }]) {
      const result = await client.callTool({ name: 'search_goals', arguments: args });
      expect(result.isError).toBe(true);
    }
    expect(services.searchGoals).not.toHaveBeenCalled();
  });
  it('does not leak raw database errors but preserves safe domain errors', async () => {
    const client = await connect();
    services.searchGoals.mockRejectedValueOnce(new Error('postgresql://secret@db/internal details'));
    const unexpected = await client.callTool({ name: 'search_goals', arguments: {} });
    expect(unexpected.isError).toBe(true);
    expect(JSON.stringify(unexpected)).not.toContain('secret');
    expect(JSON.stringify(unexpected)).toContain('INTERNAL_ERROR');
    services.searchGoals.mockRejectedValueOnce(new McpError('NOT_FOUND', 'Goal not found in this workspace.'));
    const safe = await client.callTool({ name: 'search_goals', arguments: {} });
    expect(JSON.stringify(safe)).toContain('NOT_FOUND');
  });
  it('round-trips structured read results through the official client', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'search_goals', arguments: { query: 'plan', limit: 2 } });
    expect(result.structuredContent).toEqual({ items: [], hasMore: false });
    expect(services.searchGoals).toHaveBeenCalledWith(actor, { query: 'plan', offset: 0, limit: 2 });
  });
  it('discovers a report prompt that distinguishes evidence from inferred progress', async () => {
    const client = await connect();
    const prompts = await client.listPrompts();
    expect(prompts.prompts.map(prompt => prompt.name)).toContain('progress_report');
    const result = await client.getPrompt({ name: 'progress_report', arguments: { projectId: 'project', startAt: '2026-10-01T00:00:00Z', endAt: '2026-10-08T00:00:00Z' } });
    expect(JSON.stringify(result)).toContain('exclusive');
    expect(JSON.stringify(result)).toContain('missing baselines');
    expect(JSON.stringify(result)).toContain('untrusted data');
  });
});
