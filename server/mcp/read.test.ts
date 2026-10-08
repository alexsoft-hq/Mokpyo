import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpActor } from './types';

const db = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() });
  return { organizationMember: model(), organization: model(), project: model(), statusLabel: model(), cycle: model(), category: model(), goal: model(), subGoal: model(), note: model(), auditLog: model(), checkIn: model() };
});
vi.mock('../lib/prisma', () => ({ prisma: db }));
vi.mock('./config', () => ({ goalUrl: (goalId: string) => `https://app.example/?item=${goalId}` }));
import { getCreationContext, searchGoals, getGoal, getReportContext } from './read';

const actor: McpActor = { userId: 'user', userName: 'User', organizationId: 'org', tokenId: 'token', scopes: ['mokpyo:read'] };
const goal = (id: string) => ({ id, description: 'A goal', statusNote: null, externalReferences: [], progress: 75 });
const report = { projectId: 'project', startAt: '2026-10-01T00:00:00+09:00', endAt: '2026-10-08T00:00:00+09:00', timeZone: 'Asia/Seoul' };

beforeEach(() => {
  vi.resetAllMocks();
  Object.values(db).forEach(model => model.findMany.mockResolvedValue([]));
  db.organizationMember.findUnique.mockResolvedValue({ userId: 'user' });
  db.organization.findUnique.mockResolvedValue({ id: 'org', name: 'Workspace' });
  db.project.findFirst.mockResolvedValue({ id: 'project', name: 'Project', description: '' });
  db.goal.findFirst.mockResolvedValue(goal('goal'));
});

// Inspect every nested Prisma projection: sensitive columns must never be fetched.
function assertSafeProjection(value: unknown) {
  const forbidden = new Set(['email', 'passwordHash', 'ipAddress', 'changes', 'tokenHash', 'googleId']);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    expect(forbidden.has(key), `Sensitive projection key: ${key}`).toBe(false);
    assertSafeProjection(child);
  }
}

describe('Read access and bounded pages', () => {
  it('rejects missing read scope and removed members before touching content', async () => {
    await expect(searchGoals({ ...actor, scopes: [] }, {})).rejects.toThrow('Read permission');
    db.organizationMember.findUnique.mockResolvedValue(null);
    await expect(searchGoals(actor, {})).rejects.toThrow('membership');
    expect(db.goal.findMany).not.toHaveBeenCalled();
  });
  it('rejects cross-workspace project and goal identifiers before child queries', async () => {
    db.project.findFirst.mockResolvedValue(null);
    await expect(getCreationContext(actor, { projectId: 'foreign' })).rejects.toThrow('not found');
    expect(db.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', organizationId: 'org' } }));
    expect(db.category.findMany).not.toHaveBeenCalled();
    db.goal.findFirst.mockResolvedValue(null);
    await expect(getGoal(actor, { goalId: 'foreign' })).rejects.toThrow('not found');
    expect(db.goal.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', project: { organizationId: 'org' } } }));
    expect(db.subGoal.findMany).not.toHaveBeenCalled();
    expect(db.note.findMany).not.toHaveBeenCalled();
  });
  it.each([{ limit: 51 }, { limit: 0 }, { limit: 1.5 }, { offset: -1 }, { offset: Number.MAX_SAFE_INTEGER + 1 }, { organizationId: 'foreign' }])('rejects invalid pagination or injected organization %j', async input => {
    await expect(searchGoals(actor, input)).rejects.toThrow();
    expect(db.goal.findMany).not.toHaveBeenCalled();
  });
  it('returns only the requested page and a continuation, bounded at 50', async () => {
    db.goal.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, i) => goal(`g${i}`)));
    const result = await searchGoals(actor, { offset: 10, limit: 50, query: 'plan' });
    expect(result.items).toHaveLength(50);
    expect(result.hasMore).toBe(true);
    expect(result.nextOffset).toBe(60);
    expect(db.goal.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 51, where: { project: { organizationId: 'org' }, title: { contains: 'plan', mode: 'insensitive' } }, orderBy: { id: 'asc' } }));
  });
  it('does not advertise a continuation on an exact final page or empty page', async () => {
    db.goal.findMany.mockResolvedValueOnce([goal('one'), goal('two')]);
    expect(await searchGoals(actor, { limit: 2 })).toMatchObject({ hasMore: false, nextOffset: null });
    expect(await searchGoals(actor, { offset: 100 })).toMatchObject({ items: [], hasMore: false, nextOffset: null });
  });
  it('allows the continuation beyond the former 100000-row boundary', async () => {
    db.goal.findMany.mockResolvedValueOnce([goal('one'), goal('two')]);
    const first = await searchGoals(actor, { offset: 100000, limit: 1 });
    expect(first.nextOffset).toBe(100001);
    await expect(searchGoals(actor, { offset: first.nextOffset, limit: 1 })).resolves.toMatchObject({ hasMore: false });
  });
  it('clips oversized text and marks truncated source references', async () => {
    db.goal.findMany.mockResolvedValue([{ ...goal('one'), description: 'x'.repeat(20000), statusNote: 'y'.repeat(20000), externalReferences: Array.from({ length: 21 }, (_, i) => ({ externalId: String(i) })) }]);
    const result = await searchGoals(actor, {});
    expect(result.items[0].description).toHaveLength(6012);
    expect(result.items[0].externalReferences).toHaveLength(20);
    expect(result.items[0].sourcesTruncated).toBe(true);
    expect(result.items[0].url).toBe('https://app.example/?item=one');
  });
  it('paginates notes and subgoals independently', async () => {
    db.subGoal.findMany.mockResolvedValue([goal('s1'), goal('s2'), goal('s3')]);
    db.note.findMany.mockResolvedValue([{ id: 'n1', content: 'Note' }]);
    const result = await getGoal(actor, { goalId: 'goal', subgoalOffset: 2, noteOffset: 8, limit: 2 });
    expect(result.subgoals).toMatchObject({ hasMore: true, nextOffset: 4 });
    expect(result.notes).toMatchObject({ hasMore: false, nextOffset: null });
    expect(db.subGoal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { goalId: 'goal' }, skip: 2, take: 3 }));
    expect(db.note.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { goalId: 'goal' }, skip: 8, take: 3 }));
  });
  it('projects member names but never emails, and paginates each context collection', async () => {
    db.organizationMember.findMany.mockResolvedValue([{ userId: 'u1', user: { name: 'One' } }, { userId: 'u2', user: { name: 'Two' } }]);
    db.project.findMany.mockResolvedValue([{ id: 'project' }]);
    const result = await getCreationContext(actor, { projectId: 'project', offset: 3, limit: 1 });
    expect(result.members).toEqual({ items: [{ userId: 'u1', name: 'One' }], hasMore: true, nextOffset: 4 });
    expect(result.projects.hasMore).toBe(false);
    for (const model of [db.project, db.organizationMember, db.statusLabel, db.cycle, db.category]) {
      expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 3, take: 2 }));
      assertSafeProjection(model.findMany.mock.calls[0][0].select);
    }
  });
});

describe('Report period evidence and privacy', () => {
  it('uses an inclusive start, exclusive end, UTC-equivalent instants and independent offsets', async () => {
    const result = await getReportContext(actor, { ...report, goalOffset: 1, activityOffset: 5, checkInOffset: 8, limit: 2 });
    expect(result.period).toEqual({ startAt: report.startAt, endAt: report.endAt, timeZone: report.timeZone, endExclusive: true });
    const period = { gte: new Date('2026-09-30T15:00:00Z'), lt: new Date('2026-10-07T15:00:00Z') };
    expect(db.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org', projectId: 'project', createdAt: period }, skip: 5, take: 3 }));
    expect(db.checkIn.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { goal: { projectId: 'project', project: { organizationId: 'org' } }, createdAt: period }, skip: 8, take: 3 }));
    expect(db.goal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'project', project: { organizationId: 'org' } }, skip: 1, take: 3 }));
  });
  it('keeps current progress separate from period evidence and does not infer a delta', async () => {
    db.goal.findMany.mockResolvedValue([goal('one')]);
    const result = await getReportContext(actor, report);
    expect(result.currentGoals.items[0].progress).toBe(75);
    expect(result.periodActivity.items).toEqual([]);
    expect(result.periodCheckIns.items).toEqual([]);
    expect(result.guidance).toContain('not the state at either period boundary');
    expect(result.guidance).toContain('do not invent a baseline');
    expect(result.snapshotAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(result)).not.toContain('progressDelta');
  });
  it('fetches only allowlisted audit/check-in/goal fields', async () => {
    await getReportContext(actor, report);
    for (const model of [db.goal, db.auditLog, db.checkIn]) {
      const args = model.findMany.mock.calls[0][0];
      expect(args.select).toBeDefined();
      expect(args.include).toBeUndefined();
      assertSafeProjection(args.select);
    }
    expect(Object.keys(db.auditLog.findMany.mock.calls[0][0].select).sort()).toEqual(['action', 'createdAt', 'entityId', 'entityTitle', 'entityType', 'goalId', 'id', 'summary']);
  });
  it.each([
    { startAt: '2026-02-30T00:00:00Z' }, { startAt: '2026-10-01T00:00:00' },
    { startAt: '2026-10-01' }, { endAt: '2026-10-01T00:00:00+09:00' },
    { endAt: '2026-09-01T00:00:00Z' }, { endAt: '2028-10-01T00:00:00Z' },
    { timeZone: 'Not/A_Timezone' }, { startAt: '2026-10-01T00:00:00+99:00' },
  ])('rejects malformed or misleading reporting boundaries %j', async patch => {
    await expect(getReportContext(actor, { ...report, ...patch })).rejects.toThrow();
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });
});
