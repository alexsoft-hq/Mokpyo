import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { resolveInitialStatus } from '../lib/statusSync';
import { McpActor, McpError, MCP_READ_SCOPE, MCP_WRITE_SCOPE } from './types';
import { appendSchema, importSchema, type AppendInput, type ImportInput, type SourceInput, type SubgoalInput } from './importSchemas';
export { appendSchema, importSchema } from './importSchemas';

type Db = Prisma.TransactionClient;
type Plan = ImportInput | AppendInput;
const sideEffects = 'audit only' as const;
export interface ImportResult {
  batchId: string;
  goals: { id: string; subgoalIds: string[] }[];
  sideEffects: 'audit only';
  replayed: boolean;
}
export interface AppendResult {
  batchId: string;
  goalId: string;
  subgoalIds: string[];
  version: number;
  progress: number;
  sideEffects: 'audit only' | 'audit and progress check-in only';
  replayed: boolean;
}
type StoredResult = Omit<ImportResult, 'replayed'> | Omit<AppendResult, 'replayed'>;


function authorize(actor: McpActor, write: boolean) {
  if (!actor.scopes.includes(MCP_WRITE_SCOPE) && (write || !actor.scopes.includes(MCP_READ_SCOPE))) {
    throw new McpError('FORBIDDEN', `The connection requires ${write ? MCP_WRITE_SCOPE : MCP_READ_SCOPE}.`);
  }
}
async function membership(db: Db, actor: McpActor) {
  const member = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: actor.organizationId, userId: actor.userId } },
  });
  if (!member) throw new McpError('FORBIDDEN', 'Workspace membership is required.');
}
function parse<T>(schema: { safeParse: (input: unknown) => any }, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new McpError('INVALID_INPUT', result.error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  return result.data;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
function hash(kind: string, input: Plan) {
  return createHash('sha256').update(canonical({ kind, input })).digest('hex');
}
function sourcesOf(plan: Plan): SourceInput[] {
  return 'goals' in plan ? plan.goals.flatMap(goal => [...goal.sources, ...goal.subgoals.flatMap(s => s.sources)]) : plan.subgoals.flatMap(s => s.sources);
}
function identity(source: SourceInput) { return JSON.stringify([source.provider, source.instance, source.externalId]); }
async function duplicates(db: Db, actor: McpActor, plan: Plan) {
  const sources = sourcesOf(plan);
  const seen = new Set<string>();
  const repeated = sources.filter(source => { const key = identity(source); if (seen.has(key)) return true; seen.add(key); return false; });
  const existing = sources.length ? await db.externalReference.findMany({
    where: { organizationId: actor.organizationId, OR: sources.map(({ provider, instance, externalId }) => ({ provider, instance, externalId })) },
    select: { provider: true, instance: true, externalId: true, goalId: true, subGoalId: true },
  }) : [];
  return [
    ...repeated.map(source => ({ source, reason: 'repeated_in_batch' as const })),
    ...existing.map(({ goalId, subGoalId, ...source }) => ({ source, goalId, subGoalId, reason: 'already_linked' as const })),
  ];
}
export function metricProgress(subgoal: SubgoalInput): number {
  if (subgoal.targetValue !== undefined && subgoal.currentValue !== undefined) {
    const start = subgoal.startValue ?? 0;
    return Math.max(0, Math.min(100, Math.round(((subgoal.currentValue - start) / (subgoal.targetValue - start)) * 100)));
  }
  return subgoal.progress;
}
function average(progress: number[]) { return Math.round(progress.reduce((sum, p) => sum + p, 0) / progress.length); }
function withSources(description: string | undefined, sources: SourceInput[]) {
  if (!sources.length) return description ?? null;
  // Plain URLs, never fetch external content or turn source text into instructions.
  return [description, 'Sources:', ...sources.map(source => `${source.provider} / ${source.externalId}: ${source.url}`)].filter(Boolean).join('\n');
}
async function validate(db: Db, actor: McpActor, input: Plan) {
  await membership(db, actor);
  const parent = 'goalId' in input ? await db.goal.findFirst({
    where: { id: input.goalId, project: { organizationId: actor.organizationId } },
    include: { subGoals: { select: { progress: true, order: true } } },
  }) : null;
  if ('goalId' in input && !parent) throw new McpError('NOT_FOUND', 'Goal not found in this workspace.');
  const projectId = 'projectId' in input ? input.projectId : parent!.projectId;
  const project = await db.project.findFirst({ where: { id: projectId, organizationId: actor.organizationId }, select: { id: true } });
  if (!project) throw new McpError('NOT_FOUND', 'Project not found in this workspace.');
  const items = 'goals' in input ? input.goals.flatMap(goal => [goal, ...goal.subgoals]) : input.subgoals;
  const ownerIds = [...new Set(items.flatMap(item => item.ownerIds))];
  const members = ownerIds.length ? await db.organizationMember.findMany({
    where: { organizationId: actor.organizationId, userId: { in: ownerIds } },
    select: { userId: true, user: { select: { name: true } } },
  }) : [];
  if (members.length !== ownerIds.length) throw new McpError('INVALID_REFERENCE', 'Every owner ID must be a member of this workspace.');
  const owners = new Map(members.map(member => [member.userId, member.user.name]));
  // The existing owner tables enforce unique names. Do not silently pick between namesakes.
  for (const item of items) {
    const names = item.ownerIds.map(id => owners.get(id));
    if (new Set(names).size !== names.length) throw new McpError('INVALID_REFERENCE', 'Owners with the same display name cannot be assigned together.');
  }
  if ('goals' in input) for (const goal of input.goals) {
    const categoryCount = await db.category.count({ where: { id: { in: goal.categoryIds }, projectId } });
    if (categoryCount !== goal.categoryIds.length) throw new McpError('INVALID_REFERENCE', 'Every category must belong to the selected project.');
    if (goal.statusId && !await db.statusLabel.findFirst({ where: { id: goal.statusId, organizationId: actor.organizationId } })) throw new McpError('INVALID_REFERENCE', 'Status not found in this workspace.');
    if (goal.cycleId && !await db.cycle.findFirst({ where: { id: goal.cycleId, organizationId: actor.organizationId } })) throw new McpError('INVALID_REFERENCE', 'Cycle not found in this workspace.');
    if (goal.parentGoalId && !await db.goal.findFirst({ where: { id: goal.parentGoalId, project: { organizationId: actor.organizationId } } })) throw new McpError('INVALID_REFERENCE', 'Parent goal not found in this workspace.');
  }
  return { parent, projectId, owners };
}
async function preview(actor: McpActor, input: Plan) {
  authorize(actor, false);
  const { parent, projectId } = await validate(prisma, actor, input);
  const conflicts = await duplicates(prisma, actor, input);
  const sameTitleCandidates = 'goals' in input
    ? await prisma.goal.findMany({ where: { projectId, title: { in: input.goals.map(goal => goal.title) } }, select: { id: true, title: true }, take: 100 })
    : await prisma.subGoal.findMany({ where: { goalId: parent!.id, title: { in: input.subgoals.map(s => s.title) } }, select: { id: true, title: true }, take: 100 });
  const versionConflict = 'expectedVersion' in input && parent!.version !== input.expectedVersion;
  const plan = 'goals' in input ? { ...input, goals: input.goals.map(goal => ({ ...goal,
    progress: goal.subgoals.length ? average(goal.subgoals.map(metricProgress)) : goal.progress,
    subgoals: goal.subgoals.map(subgoal => ({ ...subgoal, progress: metricProgress(subgoal) })),
  })) } : { ...input, subgoals: input.subgoals.map(subgoal => ({ ...subgoal, progress: metricProgress(subgoal) })) };
  return { canApply: conflicts.length === 0 && !versionConflict, plan, duplicates: conflicts, sameTitleCandidates,
    ...(parent ? { currentVersion: parent.version, versionConflict, resultingProgress: average([...parent.subGoals.map(s => s.progress), ...('subgoals' in input ? input.subgoals.map(metricProgress) : [])]) } : {}), sideEffects };
}
export async function previewImport(actor: McpActor, raw: unknown) { return preview(actor, parse<ImportInput>(importSchema, raw)); }
export async function previewAppend(actor: McpActor, raw: unknown) { return preview(actor, parse<AppendInput>(appendSchema, raw)); }

function ownerRows(ids: string[], owners: Map<string, string>) {
  return ids.map((userId, order) => ({ userId, ownerName: owners.get(userId)!, order }));
}
async function saveSources(db: Db, actor: McpActor, sources: SourceInput[], target: { goalId: string } | { subGoalId: string }) {
  if (sources.length) await db.externalReference.createMany({ data: sources.map(source => ({
    organizationId: actor.organizationId, provider: source.provider, instance: source.instance,
    externalId: source.externalId, url: source.url, ...target,
  })) });
}
async function createSubgoal(db: Db, actor: McpActor, goalId: string, input: SubgoalInput, owners: Map<string, string>, order: number) {
  const subgoal = await db.subGoal.create({ data: {
    goalId, title: input.title, description: withSources(input.description, input.sources),
    owner: input.ownerIds.length ? owners.get(input.ownerIds[0])! : '', progress: metricProgress(input), order,
    startDate: input.startDate, dueDate: input.dueDate,
    targetValue: input.targetValue, currentValue: input.currentValue, startValue: input.startValue, unit: input.unit,
    subGoalOwners: { create: ownerRows(input.ownerIds, owners) },
  } });
  await saveSources(db, actor, input.sources, { subGoalId: subgoal.id });
  return subgoal.id;
}
async function audit(db: Db, actor: McpActor, goalId: string, title: string, projectId: string, action: 'CREATE' | 'UPDATE', batchId: string, subgoalIds: string[]) {
  await db.auditLog.create({ data: {
    organizationId: actor.organizationId, userId: actor.userId, action, entityType: 'Goal', entityId: goalId,
    goalId, projectId, entityTitle: title, summary: action === 'CREATE' ? 'Goal imported through MCP' : 'Subgoals appended through MCP',
    changes: JSON.stringify({ source: 'mcp', tokenId: actor.tokenId, batchId, addedSubgoalIds: subgoalIds }),
  } });
}
async function mutate(actor: McpActor, input: ImportInput, kind: 'import'): Promise<ImportResult>;
async function mutate(actor: McpActor, input: AppendInput, kind: 'append'): Promise<AppendResult>;
async function mutate(actor: McpActor, input: Plan, kind: 'import' | 'append'): Promise<ImportResult | AppendResult> {
  authorize(actor, true);
  const requestHash = hash(kind, input);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async db => {
        await membership(db, actor);
        const previous = await db.mcpImportBatch.findUnique({ where: { organizationId_userId_idempotencyKey: {
          organizationId: actor.organizationId, userId: actor.userId, idempotencyKey: input.idempotencyKey,
        } } });
        if (previous) {
          if (previous.requestHash !== requestHash) throw new McpError('IDEMPOTENCY_CONFLICT', 'This idempotency key was already used with different input.');
          return { ...(previous.result as unknown as StoredResult), replayed: true };
        }
        const { parent, projectId, owners } = await validate(db, actor, input);
        const conflicts = await duplicates(db, actor, input);
        if (conflicts.length) throw new McpError('SOURCE_CONFLICT', `Source items are already linked or repeated. Run preview to inspect ${conflicts.length} conflict(s).`);
        const batchId = randomUUID();
        let result: StoredResult;
        if ('goals' in input) {
          const created: { id: string; subgoalIds: string[] }[] = [];
          for (const item of input.goals) {
            const progress = item.subgoals.length ? average(item.subgoals.map(metricProgress)) : item.progress;
            const initial = await resolveInitialStatus(actor.organizationId, { requestedStatusId: item.statusId, progress }, db);
            const goal = await db.goal.create({ data: {
              projectId, title: item.title, description: withSources(item.description, item.sources),
              owner: item.ownerIds.length ? owners.get(item.ownerIds[0])! : '', progress,
              startDate: item.startDate, dueDate: item.dueDate, cycleId: item.cycleId, parentGoalId: item.parentGoalId,
              ...initial, categories: { connect: item.categoryIds.map(id => ({ id })) },
              goalOwners: { create: ownerRows(item.ownerIds, owners) },
            } });
            await saveSources(db, actor, item.sources, { goalId: goal.id });
            const subgoalIds: string[] = [];
            for (const [order, subgoal] of item.subgoals.entries()) subgoalIds.push(await createSubgoal(db, actor, goal.id, subgoal, owners, order));
            await audit(db, actor, goal.id, goal.title, projectId, 'CREATE', batchId, subgoalIds);
            created.push({ id: goal.id, subgoalIds });
          }
          result = { batchId, goals: created, sideEffects };
        } else {
          if (parent!.version !== input.expectedVersion) throw new McpError('VERSION_CONFLICT', 'The goal changed. Refresh it and preview again with its current version.');
          const firstOrder = parent!.subGoals.reduce((max, s) => Math.max(max, s.order), -1) + 1;
          const progress = average([...parent!.subGoals.map(s => s.progress), ...input.subgoals.map(metricProgress)]);
          const updated = await db.goal.updateMany({ where: { id: input.goalId, version: input.expectedVersion, project: { organizationId: actor.organizationId } },
            data: { progress, version: { increment: 1 } } });
          if (updated.count !== 1) throw new McpError('VERSION_CONFLICT', 'The goal changed. Refresh it and preview again.');
          const subgoalIds: string[] = [];
          for (const [index, subgoal] of input.subgoals.entries()) subgoalIds.push(await createSubgoal(db, actor, input.goalId, subgoal, owners, firstOrder + index));
          if (progress !== parent!.progress) {
            await db.checkIn.create({ data: { goalId: input.goalId, userId: actor.userId, progress,
              note: 'Subgoals appended through MCP' } });
          }
          await audit(db, actor, parent!.id, parent!.title, projectId, 'UPDATE', batchId, subgoalIds);
          result = { batchId, goalId: input.goalId, subgoalIds, version: input.expectedVersion + 1, progress, sideEffects: progress !== parent!.progress ? 'audit and progress check-in only' : sideEffects };
        }
        await db.mcpImportBatch.create({ data: { id: batchId, organizationId: actor.organizationId, userId: actor.userId,
          idempotencyKey: input.idempotencyKey, requestHash, result: result as unknown as Prisma.InputJsonValue } });
        return { ...result, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
    } catch (error) {
      if (error instanceof McpError) throw error;
      const code = (error as { code?: string }).code;
      if ((code === 'P2002' || code === 'P2034') && attempt < 2) continue;
      if (code === 'P2002' || code === 'P2034') throw new McpError('CONFLICT', 'Concurrent changes prevented this import. Preview again, then retry with the same idempotency key.');
      throw new McpError('IMPORT_FAILED', 'The import could not be confirmed. Retry with the same idempotency key.');
    }
  }
  throw new McpError('CONFLICT', 'Retry with the same idempotency key.');
}
export async function importGoals(actor: McpActor, raw: unknown): Promise<ImportResult> { return mutate(actor, parse<ImportInput>(importSchema, raw), 'import'); }
export async function appendSubgoals(actor: McpActor, raw: unknown): Promise<AppendResult> { return mutate(actor, parse<AppendInput>(appendSchema, raw), 'append'); }
