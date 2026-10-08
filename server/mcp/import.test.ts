import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prisma: {} as any, status: vi.fn() }));
vi.mock('../lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('../lib/statusSync', () => ({ resolveInitialStatus: mocks.status }));
import { appendSubgoals, importGoals, previewImport } from './import';
import { appendSchema, importSchema } from './importSchemas';
import type { McpActor } from './types';

const actor: McpActor = { userId: 'user', userName: 'Alice', organizationId: 'org', tokenId: 'token', scopes: ['mokpyo:read', 'mokpyo:write'] };
const source = { provider: 'JIRA', instance: 'https://example.com/', externalId: 'APP-1', url: 'https://example.com/browse/APP-1' };
const request = () => ({ idempotencyKey: 'request-001', projectId: 'project', goals: [{ title: 'Outcome', categoryIds: ['category'], ownerIds: ['user'], subgoals: [{ title: 'Task', sources: [source] }] }] });
let state: any;
let failAudit: boolean;
let attempts: number;
let serializationFailures: number;
let memberExists: boolean;
let sameKeyRace: boolean;

function database(current: () => any) {
  return {
    organizationMember: {
      findUnique: vi.fn(async () => memberExists ? { userId: 'user' } : null),
      findMany: vi.fn(async ({ where }: any) => where.userId.in.filter((id: string) => id === 'user').map((userId: string) => ({ userId, user: { name: 'Alice' } }))),
    },
    project: { findFirst: vi.fn(async ({ where }: any) => where.id === 'project' && where.organizationId === 'org' ? { id: 'project' } : null) },
    category: { count: vi.fn(async ({ where }: any) => where.projectId === 'project' ? where.id.in.filter((id: string) => id === 'category').length : 0) },
    cycle: { findFirst: vi.fn(async () => null) },
    statusLabel: { findFirst: vi.fn(async () => null) },
    externalReference: {
      findMany: vi.fn(async ({ where }: any) => current().refs.filter((r: any) => r.organizationId === where.organizationId && where.OR.some((s: any) => s.provider === r.provider && s.instance === r.instance && s.externalId === r.externalId))),
      createMany: vi.fn(async ({ data }: any) => {
        for (const row of data) {
          if (current().refs.some((r: any) => ['organizationId', 'provider', 'instance', 'externalId'].every(key => r[key] === row[key]))) throw { code: 'P2002' };
          current().refs.push(row);
        }
      }),
    },
    goal: {
      findFirst: vi.fn(async ({ where }: any) => {
        const goal = current().goals.find((g: any) => g.id === where.id && where.project.organizationId === 'org');
        return goal ? { ...goal, subGoals: current().subs.filter((s: any) => s.goalId === goal.id) } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => current().goals.filter((g: any) => g.projectId === where.projectId && where.title.in.includes(g.title))),
      create: vi.fn(async ({ data }: any) => { const goal = { id: `goal-${current().goals.length}`, version: 0, ...data }; current().goals.push(goal); return goal; }),
      updateMany: vi.fn(async ({ where, data }: any) => { const goal = current().goals.find((g: any) => g.id === where.id && g.version === where.version); if (!goal) return { count: 0 }; Object.assign(goal, { progress: data.progress, version: goal.version + 1 }); return { count: 1 }; }),
    },
    subGoal: {
      findMany: vi.fn(async ({ where }: any) => current().subs.filter((s: any) => s.goalId === where.goalId && where.title.in.includes(s.title))),
      create: vi.fn(async ({ data }: any) => { const sub = { id: `sub-${current().subs.length}`, ...data }; current().subs.push(sub); return sub; }),
    },
    checkIn: { create: vi.fn(async ({ data }: any) => { current().checkIns.push(data); }) },
    auditLog: { create: vi.fn(async ({ data }: any) => { if (failAudit) throw new Error('Audit unavailable'); current().audits.push(data); }) },
    mcpImportBatch: {
      findUnique: vi.fn(async ({ where }: any) => current().batches.find((b: any) => Object.entries(where.organizationId_userId_idempotencyKey).every(([key, value]) => b[key] === value)) ?? null),
      create: vi.fn(async ({ data }: any) => { current().batches.push(data); return data; }),
    },
  };
}
beforeEach(() => {
  state = { goals: [], subs: [], refs: [], audits: [], checkIns: [], batches: [] };
  failAudit = false; sameKeyRace = false; attempts = 0; serializationFailures = 0; memberExists = true;
  mocks.status.mockReset().mockResolvedValue({ statusId: 'active', completed: false, onHold: false });
  Object.assign(mocks.prisma, database(() => state), {
    $transaction: vi.fn(async (operation: any, options: any) => {
      attempts++;
      expect(options.isolationLevel).toBe('Serializable');
      const staged = structuredClone(state);
      const result = await operation(database(() => staged));
      if (serializationFailures-- > 0) throw { code: 'P2034' };
      state = staged;
      if (sameKeyRace) { sameKeyRace = false; throw { code: 'P2002' }; }
      return result;
    }),
  });
});

describe('MCP import boundaries', () => {
  it('rejects unknown fields at every input level', () => {
    expect(importSchema.safeParse({ ...request(), organizationId: 'victim' }).success).toBe(false);
    const input = request();
    expect(importSchema.safeParse({ ...input, goals: [{ ...input.goals[0], completed: true }] }).success).toBe(false);
    expect(appendSchema.safeParse({ idempotencyKey: 'request-01', goalId: 'g', expectedVersion: 0, subgoals: [{ title: 'x', goalId: 'other' }] }).success).toBe(false);
  });
  it('validates calendar dates, order, metric pairs and finite arithmetic', () => {
    const goal = request().goals[0];
    for (const sub of [
      { startDate: '2026-02-29' }, { startDate: '2026-03-02', dueDate: '2026-03-01' },
      { targetValue: 10 }, { targetValue: 0, currentValue: 1 },
      { targetValue: 1e-320, currentValue: 1e308 },
    ]) expect(importSchema.safeParse({ ...request(), goals: [{ ...goal, subgoals: [{ title: 'Bad', ...sub }] }] }).success).toBe(false);
  });
  it('rejects unsafe source URLs and normalizes source identity', () => {
    for (const url of ['javascript:alert(1)', 'https://user:password@example.com']) {
      expect(importSchema.safeParse({ ...request(), goals: [{ ...request().goals[0], sources: [{ ...source, url }] }] }).success).toBe(false);
    }
    const parsed = importSchema.parse(request());
    expect(parsed.goals[0].subgoals[0].sources[0]).toMatchObject({ provider: 'jira', instance: 'https://example.com' });
  });
  it('denies read-only writes and revoked workspace membership', async () => {
    await expect(importGoals({ ...actor, scopes: ['mokpyo:read'] }, request())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(attempts).toBe(0);
    memberExists = false;
    await expect(importGoals(actor, request())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(state.goals).toHaveLength(0);
  });
  it.each(['projectId', 'ownerIds', 'categoryIds', 'statusId', 'cycleId', 'parentGoalId'])('rejects foreign %s references', async field => {
    const input: any = request();
    if (field === 'projectId') input.projectId = 'foreign';
    else input.goals[0][field] = field.endsWith('Ids') ? ['foreign'] : 'foreign';
    await expect(importGoals(actor, input)).rejects.toMatchObject({ code: field === 'projectId' ? 'NOT_FOUND' : 'INVALID_REFERENCE' });
    expect(state.goals).toHaveLength(0);
  });
  it('previews duplicate sources without writing or seeding statuses', async () => {
    const input = request(); input.goals[0].subgoals.push({ title: 'Duplicate', sources: [source] });
    const preview = await previewImport(actor, input);
    expect(preview.canApply).toBe(false);
    expect(preview.duplicates[0].reason).toBe('repeated_in_batch');
    expect(attempts).toBe(0);
    expect(mocks.status).not.toHaveBeenCalled();
    await expect(importGoals(actor, input)).rejects.toMatchObject({ code: 'SOURCE_CONFLICT' });
    expect(state.goals).toHaveLength(0);
  });
  it('commits graph, owner IDs, source mapping, audit and idempotency together', async () => {
    const result = await importGoals(actor, request());
    expect(result).toMatchObject({ replayed: false, sideEffects: 'audit only' });
    expect(state.goals[0].goalOwners.create).toEqual([{ userId: 'user', ownerName: 'Alice', order: 0 }]);
    expect(state.subs[0].description).toContain(source.url);
    expect(state.refs[0]).toMatchObject({ organizationId: 'org', subGoalId: 'sub-0', provider: 'jira' });
    expect(state.audits).toHaveLength(1); expect(state.batches).toHaveLength(1);
  });
  it('rolls back graph and mappings on late failure', async () => {
    failAudit = true;
    await expect(importGoals(actor, request())).rejects.toMatchObject({ code: 'IMPORT_FAILED' });
    expect(state).toEqual({ goals: [], subs: [], refs: [], audits: [], checkIns: [], batches: [] });
  });
  it('replays identical requests without duplicate writes and rejects changed payloads', async () => {
    const first = await importGoals(actor, request());
    const replay = await importGoals(actor, request());
    expect(replay).toEqual({ ...first, replayed: true });
    expect(state.goals).toHaveLength(1); expect(state.audits).toHaveLength(1);
    const changed = request(); changed.goals[0].title = 'Changed';
    await expect(importGoals(actor, changed)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it('retries serialization failures without retaining rolled-back objects', async () => {
    serializationFailures = 1;
    await importGoals(actor, request());
    expect(attempts).toBe(2); expect(state.goals).toHaveLength(1); expect(state.refs).toHaveLength(1);
  });
  it('returns the committed result when a competing same-key request wins the unique constraint race', async () => {
    sameKeyRace = true;
    const result = await importGoals(actor, request());
    expect(result).toMatchObject({ replayed: true });
    expect(attempts).toBe(2);
    expect(state.goals).toHaveLength(1); expect(state.batches).toHaveLength(1);
  });
  it('rejects duplicate sources on a new key but does not expose another workspace', async () => {
    await importGoals(actor, request());
    await expect(importGoals(actor, { ...request(), idempotencyKey: 'another-request' })).rejects.toMatchObject({ code: 'SOURCE_CONFLICT' });
    state.refs[0].organizationId = 'other';
    const result = await previewImport(actor, request());
    expect(result.duplicates).toEqual([]);
  });
  it('records a progress check-in atomically with append and only once on replay', async () => {
    state.goals.push({ id: 'parent', projectId: 'project', title: 'Parent', version: 0, progress: 0 });
    state.subs.push({ id: 'old', goalId: 'parent', title: 'Keep', order: 0, progress: 0 });
    const input = { idempotencyKey: 'append-progress', goalId: 'parent', expectedVersion: 0, subgoals: [{ title: 'New', progress: 100 }] };
    failAudit = true;
    await expect(appendSubgoals(actor, input)).rejects.toMatchObject({ code: 'IMPORT_FAILED' });
    expect(state.checkIns).toEqual([]); expect(state.subs).toHaveLength(1); expect(state.goals[0].version).toBe(0);
    failAudit = false;
    const result = await appendSubgoals(actor, input);
    expect(result).toMatchObject({ progress: 50, sideEffects: 'audit and progress check-in only' });
    expect(state.checkIns).toEqual([{ goalId: 'parent', userId: 'user', progress: 50, note: 'Subgoals appended through MCP' }]);
    await appendSubgoals(actor, input);
    expect(state.checkIns).toHaveLength(1);
  });
  it('appends without changing old subgoals or explicit status and replays old expectedVersion', async () => {
    state.goals.push({ id: 'parent', projectId: 'project', title: 'Parent', version: 3, progress: 100, statusId: 'on_hold', completed: false, onHold: true });
    state.subs.push({ id: 'old', goalId: 'parent', title: 'Keep', order: 5, progress: 100 });
    const old = structuredClone(state.subs[0]);
    const input = { idempotencyKey: 'append-001', goalId: 'parent', expectedVersion: 3, subgoals: [{ title: 'New', targetValue: 10, currentValue: 20 }] };
    const result = await appendSubgoals(actor, input);
    expect(result).toMatchObject({ version: 4, progress: 100 });
    expect(state.subs[0]).toEqual(old); expect(state.subs[1]).toMatchObject({ order: 6, progress: 100 });
    expect(state.goals[0]).toMatchObject({ statusId: 'on_hold', completed: false, onHold: true });
    expect(mocks.status).not.toHaveBeenCalled();
    expect(state.checkIns).toHaveLength(0);
    expect(await appendSubgoals(actor, input)).toMatchObject({ replayed: true, version: 4 });
    await expect(appendSubgoals(actor, { ...input, idempotencyKey: 'append-002' })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(state.subs).toHaveLength(2);
  });
});
