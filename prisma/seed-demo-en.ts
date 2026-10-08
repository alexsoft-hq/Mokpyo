import 'dotenv/config';
import { Prisma, PrismaClient, MemberRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { projects } from './demo-en-data';

// Create-only local fixture. Re-running refuses to touch an existing workspace.
// DEMO_OWNER_EMAIL adds an existing OWNER alongside the synthetic login;
// that user's profile is never changed or copied into the public fixture.
const slug = 'mokpyo-labs-en-demo';
const id = (key: string) => `demo-en-${key}`;
const json = (value: unknown) => value as Prisma.InputJsonValue;
const now = new Date();
const dateAt = (days: number) => new Date(now.getTime() + days * 86_400_000);
const day = (days: number) => dateAt(days).toISOString().slice(0, 10);

const statuses = [
  ['todo', 'Not started', '#94a3b8', 'active', true],
  ['doing', 'In progress', '#3b82f6', 'active', true],
  ['review', 'In review', '#8b5cf6', 'active', false],
  ['validate', 'User validation', '#06b6d4', 'active', false],
  ['risk', 'At risk', '#ef4444', 'active', false],
  ['deploy', 'Ready to ship', '#f97316', 'active', false],
  ['hold', 'On hold', '#f59e0b', 'on_hold', true],
  ['done', 'Done', '#22c55e', 'done', true],
] as const;
const people = [
  ['owner', 'Alex Morgan'], ['pm', 'Jordan Lee'], ['frontend', 'Sam Rivera'],
  ['backend', 'Taylor Chen'], ['ai', 'Casey Brooks'], ['design', 'Robin Patel'],
  ['qa', 'Jamie Wilson'], ['devops', 'Avery Kim'], ['success', 'Charlie Davis'],
  ['mobile', 'Riley Park'], ['research', 'Morgan Reed'], ['data', 'Quinn Carter'],
  ['security', 'Drew Ellis'], ['support', 'Cameron Blake'],
] as const;
const categories = [
  ['feature', 'Feature', '#3b82f6'], ['quality', 'Quality', '#22c55e'],
  ['tech', 'Technical debt', '#f97316'], ['research', 'Research', '#8b5cf6'],
  ['operation', 'Operations', '#64748b'], ['growth', 'Growth experiment', '#ec4899'],
  ['security', 'Security', '#ef4444'], ['data', 'Data', '#06b6d4'],
] as const;
const priorities = [
  { id: 'p_xl', label: 'Critical', color: '#ef4444' },
  { id: 'p_large', label: 'High', color: '#f97316' },
  { id: 'p_medium', label: 'Medium', color: '#eab308' },
  { id: 'p_small', label: 'Low', color: '#3b82f6' },
  { id: 'p_xs', label: 'Lowest', color: '#9ca3af' },
];
const fields = [
  { key: 'priority', name: 'Priority', type: 'priority', config: { options: priorities } },
  { key: 'team', name: 'Team', type: 'dropdown', config: { options: [['product', 'Product'], ['frontend', 'Frontend'], ['backend', 'Backend'], ['ai', 'AI/ML'], ['platform', 'Platform'], ['design', 'Design'], ['mobile', 'Mobile'], ['security', 'Security'], ['data', 'Data'], ['success', 'Customer Success']].map(([key, label]) => ({ id: `team_${key}`, label, color: '#3b82f6' })), multi: true } },
  { key: 'effort', name: 'Estimated effort', type: 'number', config: { unit: 'SP' } },
  { key: 'release', name: 'Target release', type: 'date', config: {} },
  { key: 'lead', name: 'Technical lead', type: 'person', config: {} },
  { key: 'risk', name: 'Risk and next step', type: 'text', config: {} },
];
// Retain source schedule spacing while keeping the fixture useful on execution day.
const sourceAnchor = Date.parse('2026-09-08T00:00:00Z');
const shiftedDay = (value: string) => day(Math.round((Date.parse(`${value}T00:00:00Z`) - sourceAnchor) / 86_400_000));
const cycleKeys = { annual: 'annual', q3: '0', q4: '1', next: '2' };

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  // Do not print the URL: it can contain credentials.
  let parsed: URL;
  try { parsed = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL must be a valid local PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname)) {
    throw new Error('The English demo can only be created on a loopback PostgreSQL host.');
  }
  // Reject alternate host/socket/schema selectors that could override the checked host.
  const allowedParameters = new Set(['schema', 'connection_limit', 'pool_timeout', 'connect_timeout', 'sslmode']);
  for (const key of parsed.searchParams.keys()) {
    if (!allowedParameters.has(key)) throw new Error(`Unsupported database URL parameter: ${key}`);
  }
  const ownerEmail = process.env.DEMO_OWNER_EMAIL?.trim();
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password) throw new Error('Set DEMO_USER_PASSWORD for the synthetic owner login.');
  const passwordHash = await bcrypt.hash(password, 10);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const result = await prisma.$transaction(async tx => {
      if (await tx.organization.findUnique({ where: { slug }, select: { id: true } })) {
        throw new Error(`Workspace ${slug} already exists; no data was changed.`);
      }
      const additionalOwner = ownerEmail
        ? await tx.user.findUnique({ where: { email: ownerEmail }, select: { id: true } })
        : null;
      if (ownerEmail && !additionalOwner) throw new Error('DEMO_OWNER_EMAIL must identify an existing local user.');
      const members = new Map<string, { id: string; name: string }>();
      for (const [key, name] of people) {
        const email = `mokpyo.demo.en.${key}@example.invalid`;
        if (await tx.user.findUnique({ where: { email }, select: { id: true } })) {
          throw new Error(`Synthetic user collision (${key}); no existing user will be modified.`);
        }
        const user = await tx.user.create({ data: { id: id(`user-${key}`), email, name, isEmailVerified: true, passwordHash: key === 'owner' ? passwordHash : null } });
        members.set(key, { id: user.id, name: user.name });
      }
      const member = (key: string) => {
        const value = members.get(key);
        if (!value) throw new Error(`Unknown fixture member: ${key}`);
        return value;
      };
      const owner = member('owner');
      const organization = await tx.organization.create({ data: { id: id('org'), slug, name: 'Mokpyo Labs · Demo' } });
      const organizationId = organization.id;
      for (const [key] of people) {
        await tx.organizationMember.create({ data: { organizationId, userId: member(key).id, role: key === 'owner' ? MemberRole.OWNER : key === 'pm' ? MemberRole.ADMIN : MemberRole.MEMBER } });
      }
      if (additionalOwner) await tx.organizationMember.create({ data: { organizationId, userId: additionalOwner.id, role: MemberRole.OWNER } });
      for (const [order, [key, name, color, kind, isSystem]] of statuses.entries()) {
        await tx.statusLabel.create({ data: { id: id(`status-${key}`), organizationId, name, color, kind, isSystem, order } });
      }
      const year = now.getUTCFullYear();
      const quarter = Math.floor(now.getUTCMonth() / 3);
      for (const offset of [0, 1, 2]) {
        const start = new Date(Date.UTC(year, (quarter + offset) * 3, 1));
        const end = new Date(Date.UTC(year, (quarter + offset + 1) * 3, 0));
        await tx.cycle.create({ data: { id: id(`cycle-${offset}`), organizationId, name: `${start.getUTCFullYear()} Q${Math.floor(start.getUTCMonth() / 3) + 1}`, type: 'quarter', startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) } });
      }
      await tx.cycle.create({ data: { id: id('cycle-annual'), organizationId, name: `${year} Annual`, type: 'annual', startDate: `${year}-01-01`, endDate: `${year}-12-31` } });
      let goalCount = 0;
      for (const [projectIndex, project] of projects.entries()) {
        const projectId = id(`project-${project.key}`);
        await tx.project.create({ data: { id: projectId, organizationId, name: project.name, description: project.description, dashboardTitle: project.name, dashboardSubtitle: 'A shared plan. Visible progress. Clear next steps.', parentId: project.parent ? id(`project-${project.parent}`) : null } });
        for (const [key, name, color] of categories) {
          await tx.category.create({ data: { id: id(`category-${project.key}-${key}`), projectId, name, color } });
        }
        for (const [order, field] of fields.entries()) {
          await tx.customFieldDefinition.create({ data: { id: id(`field-${project.key}-${field.key}`), projectId, name: field.name, type: field.type, config: json(field.config), order } });
        }
        for (const [index, spec] of project.goals.entries()) {
          const { title, description, riskNote: risk, progress, effort, statusKey: status } = spec;
          const goalId = spec.id;
          const owners = spec.ownerKeys.map(key => member(key));
          const lead = owners[0];
          const second = owners[1] ?? lead;
          const startDate = shiftedDay(spec.startDate);
          const dueDate = shiftedDay(spec.dueDate);
          const customFields = Object.fromEntries(Object.entries({ priority: spec.priority, team: spec.teams, effort, release: dueDate, lead: [{ userId: lead.id, name: lead.name }], risk }).map(([key, value]) => [id(`field-${project.key}-${key}`), value]));
          await tx.goal.create({ data: { id: goalId, projectId, title, description, owner: lead.name, progress, size: spec.size, startDate, dueDate, statusNote: risk, order: index, statusId: id(`status-${status}`), cycleId: id(`cycle-${cycleKeys[spec.cycleKey]}`), parentGoalId: 'alignedTo' in spec ? spec.alignedTo : null, completed: status === 'done', onHold: status === 'hold', customFields: json(customFields), categories: { connect: spec.categoryKeys.map(key => ({ id: id(`category-${project.key}-${key}`) })) } } });
          for (const [order, assignee] of owners.entries()) {
            await tx.goalOwner.create({ data: { goalId, userId: assignee.id, ownerName: assignee.name, order } });
          }
          const steps = ['Agree on scope and success criteria', 'Review the user flow and technical design', 'Build and validate the core implementation', 'Complete regression testing and release checks', 'Roll out gradually and measure the outcome'];
          for (const [order, subTitle] of steps.entries()) {
            const subProgress = progress === 100 ? 100 : Math.max(0, Math.min(100, progress + [25, 12, -5, -20, -35][order]));
            const assignee = order === 3 ? member('qa') : order % 2 === 0 ? lead : second;
            const sub = await tx.subGoal.create({ data: { id: id(`subgoal-${project.key}-${index}-${order}`), goalId, title: subTitle, description: `${subTitle} for ${title.toLowerCase()}.`, owner: assignee.name, progress: subProgress, startDate, dueDate, order, targetValue: 100, currentValue: subProgress, startValue: 0, unit: '%' } });
            await tx.subGoalOwner.create({ data: { subGoalId: sub.id, userId: assignee.id, ownerName: assignee.name } });
          }
          await tx.note.createMany({ data: [
            { goalId, content: `This week's focus: ${risk}`, isPinned: index % 3 === 0 },
            { goalId, content: `Decision: keep the current scope through ${dueDate}. Put additional requests into the next planning cycle.` },
          ] });
          for (const [checkIndex, daysAgo] of [21, 10, 1].entries()) {
            await tx.checkIn.create({ data: { goalId, userId: lead.id, progress: Math.max(0, progress - (2 - checkIndex) * 9), confidence: status === 'risk' ? 'at_risk' : status === 'hold' ? 'off_track' : 'on_track', note: checkIndex === 2 ? `Progress is now ${progress}%. ${risk}` : ['Reviewed scope and dependencies with the team.', 'Shared the current deliverable for stakeholder review.'][checkIndex], createdAt: dateAt(-daysAgo) } });
          }
          const comment = await tx.comment.create({ data: { goalId, authorId: lead.id, authorName: lead.name, body: `The next review should focus on this: ${risk}`, createdAt: dateAt(-3) } });
          await tx.comment.create({ data: { goalId, authorId: second.id, authorName: second.name, parentId: comment.id, body: 'Agreed. I have reflected this in the plan and will share the validation results at our next check-in.', createdAt: dateAt(-2) } });
          if (goalCount % 3 === 0) await tx.comment.create({ data: { goalId, authorId: member('pm').id, authorName: member('pm').name, body: 'Please include the observed result and remaining uncertainty in the completion review.', createdAt: dateAt(-1) } });
          await tx.auditLog.createMany({ data: [
            { organizationId, projectId, goalId, entityType: 'Goal', entityId: goalId, entityTitle: title, action: 'UPDATE', summary: `Updated progress to ${progress}%`, userId: lead.id, changes: JSON.stringify({ progress }), createdAt: dateAt(-2) },
            { organizationId, projectId, goalId, entityType: 'Goal', entityId: goalId, entityTitle: title, action: 'UPDATE', summary: 'Reviewed status, owners, and the next milestone', userId: second.id, changes: JSON.stringify({ statusId: id(`status-${status}`) }), createdAt: dateAt(-1) },
          ] });
          goalCount++;
        }
        const views = [
          { name: 'Quarterly execution', type: 'table', config: { v: 1, groupBy: 'status', sorting: [{ id: 'dueDate', desc: false }] } },
          { name: 'Delivery board', type: 'board', config: { v: 1, kanbanFieldId: 'status' } },
          { name: 'Team overview', type: 'dashboard', config: { v: 1, widgets: [{ type: 'progress-summary' }, { type: 'status-distribution' }, { type: 'due-soon' }] } },
          { name: 'Release timeline', type: 'timeline', config: { v: 1 } },
        ];
        for (const [order, view] of views.entries()) await tx.savedView.create({ data: { id: id(`view-${project.key}-${view.type}`), organizationId, projectId, createdById: owner.id, name: view.name, type: view.type, isShared: true, isDefault: order === 0, order, config: json(view.config) } });
        await tx.automationRule.create({ data: { id: id(`rule-${project.key}`), organizationId, projectId, createdById: owner.id, name: 'Remind owners three days before the due date', enabled: false, triggerType: 'due_date_approaching', triggerConfig: { daysBefore: 3 }, condition: [{ attr: 'completed', op: 'eq', value: false }], actions: [{ type: 'notify_assignees', config: { message: 'This goal is due in three days. Please review the next step.' } }] } });
        for (const index of [0, 1]) await tx.notification.create({ data: { organizationId, recipientId: owner.id, actorId: member('pm').id, actorName: member('pm').name, type: index === 0 ? 'CHECK_IN' : 'DUE_SOON', title: index === 0 ? 'A new check-in is ready' : 'A goal needs a due-date review', body: project.goals[index].title, entityType: 'Goal', entityId: project.goals[index].id, read: projectIndex % 3 === 0, createdAt: dateAt(-(projectIndex / 8)) } });
      }
      await tx.setting.create({ data: { organizationId, key: 'companyProfile', value: JSON.stringify({ industry: 'Software', stage: 'Demo', employees: 14 }) } });
      return { workspace: slug, organizationId, members: people.length + (additionalOwner ? 1 : 0), createdUsers: people.length, projects: projects.length, goals: goalCount, subGoals: goalCount * 5, notes: goalCount * 2, checkIns: goalCount * 3, comments: goalCount * 2 + Math.ceil(goalCount / 3), auditLogs: goalCount * 2, statusLabels: statuses.length, cycles: 4, categories: projects.length * categories.length, customFields: projects.length * fields.length, savedViews: projects.length * 4, automationRules: projects.length, notifications: projects.length * 2 };
    }, { maxWait: 10_000, timeout: 120_000 });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  // Prisma errors may embed connection context; only explicit fixture errors are printed.
  console.error(error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientInitializationError
    ? 'Demo creation failed. The transaction was rolled back; check local connectivity and fixture ID conflicts.'
    : error instanceof Error ? error.message : 'Demo creation failed.');
  process.exitCode = 1;
});
