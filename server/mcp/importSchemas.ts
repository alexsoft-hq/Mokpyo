import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const identifier = text(100);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date (YYYY-MM-DD).');
const webUrl = z.string().trim().max(2048).transform((value, ctx) => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Use an HTTP(S) URL without embedded credentials.' });
    return z.NEVER;
  }
});
export const sourceSchema = z.object({
  provider: text(50).regex(/^[a-zA-Z0-9._-]+$/).transform(value => value.toLowerCase()),
  instance: webUrl.transform(value => {
    const url = new URL(value);
    url.hash = ''; url.search = '';
    return url.href.replace(/\/+$/, '');
  }),
  externalId: text(200),
  url: webUrl,
}).strict();
const owners = z.array(identifier).max(20).default([]).refine(ids => new Set(ids).size === ids.length, 'Duplicate owner IDs.');
const common = {
  title: text(300), description: z.string().max(10000).optional(), ownerIds: owners,
  progress: z.number().int().min(0).max(100).default(0),
  startDate: date.optional(), dueDate: date.optional(),
  sources: z.array(sourceSchema).max(20).default([]),
};
function datesOrdered(value: { startDate?: string; dueDate?: string }, ctx: z.RefinementCtx) {
  if (value.startDate && value.dueDate && value.startDate > value.dueDate) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date must not precede start date.' });
  }
}
export const subgoalSchema = z.object({
  ...common,
  targetValue: z.number().finite().optional(), currentValue: z.number().finite().optional(),
  startValue: z.number().finite().optional(), unit: text(50).optional(),
}).strict().superRefine((value, ctx) => {
  datesOrdered(value, ctx);
  const hasMetric = value.targetValue !== undefined || value.currentValue !== undefined || value.startValue !== undefined;
  if (hasMetric && (value.targetValue === undefined || value.currentValue === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Metrics require both targetValue and currentValue.' });
  }
  if (hasMetric && value.targetValue === (value.startValue ?? 0)) {
    ctx.addIssue({ code: 'custom', path: ['targetValue'], message: 'Target must differ from the baseline.' });
  }
  if (hasMetric && !Number.isFinite((value.currentValue! - (value.startValue ?? 0)) / (value.targetValue! - (value.startValue ?? 0)))) {
    ctx.addIssue({ code: 'custom', message: 'Metric calculation must be finite.' });
  }
});
export const goalSchema = z.object({
  ...common,
  categoryIds: z.array(identifier).min(1).max(5).refine(ids => new Set(ids).size === ids.length, 'Duplicate category IDs.'),
  statusId: identifier.optional(), cycleId: identifier.optional(), parentGoalId: identifier.optional(),
  subgoals: z.array(subgoalSchema).max(100).default([]),
}).strict().superRefine(datesOrdered);
export const importSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(100), projectId: identifier,
  goals: z.array(goalSchema).min(1).max(10),
}).strict().refine(input => input.goals.reduce((sum, goal) => sum + goal.subgoals.length, 0) <= 100,
  'A batch may contain at most 100 subgoals.');
export const appendSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(100), goalId: identifier,
  expectedVersion: z.number().int().min(0), subgoals: z.array(subgoalSchema).min(1).max(50),
}).strict();
export type ImportInput = z.infer<typeof importSchema>;
export type AppendInput = z.infer<typeof appendSchema>;
export type SourceInput = z.infer<typeof sourceSchema>;
export type SubgoalInput = z.infer<typeof subgoalSchema>;
