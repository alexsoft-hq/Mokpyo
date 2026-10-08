/** Real PostgreSQL + HTTP + official MCP client verification. Use an EMPTY, disposable database. */
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const database = process.env.MCP_TEST_DATABASE_URL;
if (!database) throw new Error('Set MCP_TEST_DATABASE_URL to an empty, migrated local PostgreSQL database named mokpyo_mcp_test*.');
const dbUrl = new URL(database);
if (!['localhost', '127.0.0.1', '[::1]'].includes(dbUrl.hostname) || !/^\/mokpyo_mcp_test[a-zA-Z0-9_]*$/.test(dbUrl.pathname)) {
  throw new Error('Integration verification only permits loopback databases named mokpyo_mcp_test*.');
}
process.env.DATABASE_URL = database;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.SESSION_SECRET = randomBytes(32).toString('hex');
process.env.AUTOMATIONS_ENABLED = 'false';
process.env.NODE_ENV = 'test';
// Discover a loopback port before importing app: OAuth metadata is built at mount time.
const reservation = createServer();
await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
const address = reservation.address();
if (!address || typeof address === 'string') throw new Error('Missing listener port');
const base = `http://127.0.0.1:${address.port}`;
await new Promise<void>(resolve => reservation.close(() => resolve()));
process.env.APP_URL = base;
process.env.MCP_PUBLIC_URL = `${base}/mcp`;
const { app } = await import('../server/app');
const { prisma } = await import('../server/lib/prisma');
const { generateToken } = await import('../server/auth/jwt');
assert.equal(await prisma.organization.count(), 0, 'Use an empty disposable database, never an existing workspace.');
const server = app.listen(address.port, '127.0.0.1');
const clients: Client[] = [];
const checks: string[] = [];
async function json(path: string, body?: unknown, jwt?: string, method?: string) {
  const response = await fetch(`${base}${path}`, { method: method || (body === undefined ? 'GET' : 'POST'), redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { response, data: await response.json() };
}
async function form(path: string, data: Record<string, string>) {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) });
  return { response, data: await response.json() };
}
try {
  const user = await prisma.user.create({ data: { email: 'mcp-verifier@example.invalid', name: 'MCP Verifier', isEmailVerified: true } });
  const org = await prisma.organization.create({ data: { name: 'MCP verification', slug: 'mcp-verification', members: { create: { userId: user.id, role: 'OWNER' } } } });
  const foreign = await prisma.organization.create({ data: { name: 'Other workspace', slug: 'mcp-other' } });
  const project = await prisma.project.create({ data: { name: 'Import verification', organizationId: org.id } });
  const foreignProject = await prisma.project.create({ data: { name: 'Foreign project', organizationId: foreign.id } });
  const category = await prisma.category.create({ data: { name: 'Product', color: '#000000', projectId: project.id } });
  const jwt = generateToken({ userId: user.id, email: user.email, name: user.name });
  const registration = await json('/oauth/mcp/register', { client_name: 'MCP integration verifier', redirect_uris: ['http://127.0.0.1:44555/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'] });
  assert.equal(registration.response.status, 201);
  const clientId = registration.data.client_id;
  const discovery = await json('/.well-known/oauth-protected-resource/mcp');
  assert.equal(discovery.data.resource, `${base}/mcp`);
  checks.push('OAuth discovery and dynamic registration');

  async function authorize(scopes: string[], testBadVerifier = false) {
    const verifier = randomBytes(32).toString('base64url');
    const query = new URLSearchParams({ client_id: clientId, redirect_uri: 'http://127.0.0.1:44555/callback', response_type: 'code', code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'), resource: `${base}/mcp`, scope: scopes.join(' '), state: 'verify-state' });
    const response = await fetch(`${base}/oauth/mcp/authorize?${query}`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const pending = new URL(response.headers.get('location')!).searchParams.get('request');
    assert.equal((await json(`/api/mcp/consent/${pending}`)).response.status, 401);
    const consent = await json(`/api/mcp/consent/${pending}`, undefined, jwt);
    assert.equal(consent.response.status, 200);
    const allow = await json(`/api/mcp/consent/${pending}`, { approved: true, organizationId: org.id, scopes }, jwt);
    assert.equal(allow.response.status, 200);
    const callback = new URL(allow.data.redirectUrl);
    assert.equal(callback.searchParams.get('state'), 'verify-state');
    const args = { grant_type: 'authorization_code', client_id: clientId, code: callback.searchParams.get('code')!, redirect_uri: 'http://127.0.0.1:44555/callback', code_verifier: verifier, resource: `${base}/mcp` };
    if (testBadVerifier) assert.equal((await form('/oauth/mcp/token', { ...args, code_verifier: 'z'.repeat(43) })).response.status, 400);
    const exchange = await form('/oauth/mcp/token', args);
    assert.equal(exchange.response.status, 200, JSON.stringify(exchange.data));
    assert.equal((await form('/oauth/mcp/token', args)).response.status, 400, 'Authorization code must be single-use');
    return exchange.data as { access_token: string; refresh_token: string };
  }
  async function connect(accessToken: string) {
    const client = new Client({ name: 'Mokpyo integration verifier', version: '1.0.0' });
    clients.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${accessToken}` } } }));
    return client;
  }
  const readTokens = await authorize(['mokpyo:read'], true);
  const writeTokens = await authorize(['mokpyo:read', 'mokpyo:write']);
  const reader = await connect(readTokens.access_token);
  const writer = await connect(writeTokens.access_token);
  const readTools = await reader.listTools();
  const writeTools = await writer.listTools();
  assert.equal(readTools.tools.length, 6);
  assert.equal(writeTools.tools.length, 8);
  assert(!readTools.tools.some(t => t.name === 'import_goals'));
  assert.equal((await reader.callTool({ name: 'import_goals', arguments: {} })).isError, true);
  checks.push('PKCE, single-use codes, official SDK initialize/discovery and scoped tool visibility');
  async function call(client: Client, name: string, args: Record<string, unknown>) {
    const response = await client.callTool({ name, arguments: args });
    assert(!response.isError, `${name}: ${JSON.stringify(response.content)}`);
    return response.structuredContent as Record<string, any>;
  }
  assert.equal((await reader.callTool({ name: 'get_creation_context', arguments: { projectId: foreignProject.id } })).isError, true);
  const context = await call(reader, 'get_creation_context', { projectId: project.id });
  assert.equal(context.categories.items[0].id, category.id);
  const source = { provider: 'jira', instance: 'https://example.atlassian.net', externalId: 'APP-10', url: 'https://example.atlassian.net/browse/APP-10' };
  const batch = { idempotencyKey: 'integration-goals-1', projectId: project.id, goals: [{ title: 'Improve onboarding', categoryIds: [category.id], ownerIds: [user.id], subgoals: [{ title: 'Validate signup', progress: 50, sources: [source] }] }] };
  const before = await prisma.goal.count();
  const preview = await call(reader, 'preview_goal_import', batch);
  assert.equal(preview.canApply, true);
  assert.equal(await prisma.goal.count(), before);
  // Simultaneous identical writes must converge to the same committed result.
  const secondWriter = await connect(writeTokens.access_token);
  const [saved, replay] = await Promise.all([call(writer, 'import_goals', batch), call(secondWriter, 'import_goals', batch)]);
  assert.equal(saved.goals[0].id, replay.goals[0].id);
  assert.equal(await prisma.goal.count(), before + 1);
  assert.equal(await prisma.externalReference.count(), 1);
  assert.equal(await prisma.mcpImportBatch.count(), 1);
  const duplicatePreview = await call(reader, 'preview_goal_import', { ...batch, idempotencyKey: 'another-key' });
  assert.equal(duplicatePreview.canApply, false);
  assert.equal(duplicatePreview.duplicates[0].reason, 'already_linked');
  assert.equal((await writer.callTool({ name: 'import_goals', arguments: { ...batch, idempotencyKey: 'duplicate-source-key' } })).isError, true);
  assert.equal((await writer.callTool({ name: 'import_goals', arguments: { ...batch, goals: [{ ...batch.goals[0], title: 'Changed payload' }] } })).isError, true);
  checks.push('Cross-workspace denial, preview without writes, concurrent idempotency, source deduplication');

  const goalId = saved.goals[0].id;
  const current = await call(reader, 'get_goal', { goalId });
  assert.equal(current.subgoals.items[0].externalReferences[0].externalId, 'APP-10');
  const originalSubgoal = await prisma.subGoal.findFirstOrThrow({ where: { goalId } });
  const append = { idempotencyKey: 'integration-append-1', goalId, expectedVersion: current.goal.version, subgoals: [{ title: 'Improve recovery messages', progress: 0 }] };
  const appended = await call(writer, 'append_subgoals', append);
  assert.equal(appended.version, current.goal.version + 1);
  assert.equal(appended.progress, 25);
  assert.equal((await prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).progress, 25);
  assert.deepEqual(await prisma.subGoal.findUnique({ where: { id: originalSubgoal.id } }), originalSubgoal);
  assert.equal((await call(writer, 'append_subgoals', append)).replayed, true);
  assert.equal(await prisma.subGoal.count({ where: { goalId } }), 2);
  const checkIns = await prisma.checkIn.findMany({ where: { goalId } });
  assert.equal(checkIns.length, 1, 'An idempotent replay must not duplicate the progress check-in');
  assert.equal(checkIns[0].progress, 25);
  assert.equal(checkIns[0].userId, user.id);
  assert.equal((await writer.callTool({ name: 'append_subgoals', arguments: { ...append, idempotencyKey: 'integration-stale' } })).isError, true);
  checks.push('Append preserves existing subgoals, optimistic version, replay and progress check-in');

  // A DB trigger simulates a failure after goal rows were inserted. Only this disposable database is touched.
  await prisma.$executeRawUnsafe(`CREATE FUNCTION mcp_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.summary = 'Goal imported through MCP' THEN RAISE EXCEPTION 'integration injected audit failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER mcp_test_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION mcp_test_fail_audit()`);
  const failBatch = { ...batch, idempotencyKey: 'integration-rollback', goals: [{ title: 'Must roll back', categoryIds: [category.id] }] };
  assert.equal((await writer.callTool({ name: 'import_goals', arguments: failBatch })).isError, true);
  assert.equal(await prisma.goal.count({ where: { title: 'Must roll back' } }), 0);
  assert.equal(await prisma.mcpImportBatch.count({ where: { idempotencyKey: failBatch.idempotencyKey } }), 0);
  await prisma.$executeRawUnsafe('DROP TRIGGER mcp_test_audit_failure ON "AuditLog"');
  await prisma.$executeRawUnsafe('DROP FUNCTION mcp_test_fail_audit()');
  assert.equal((await call(writer, 'import_goals', failBatch)).goals.length, 1);
  checks.push('Real transaction rollback after inserted goals and successful same-key retry');

  await prisma.auditLog.create({ data: { action: 'UPDATE', entityType: 'Goal', entityId: goalId, goalId, projectId: project.id, organizationId: org.id, summary: 'Period evidence', ipAddress: 'private-ip', changes: 'private-raw-change', createdAt: new Date('2026-10-07T12:00:00Z') } });
  const report = await call(reader, 'get_report_context', { projectId: project.id, startAt: '2026-10-07T00:00:00Z', endAt: '2026-10-08T00:00:00Z', timeZone: 'UTC', limit: 1 });
  assert.equal(report.period.endExclusive, true);
  assert.equal(report.currentGoals.hasMore, true);
  assert.equal(report.periodActivity.items[0].summary, 'Period evidence');
  assert(!JSON.stringify(report).includes('private-ip'));
  assert(!JSON.stringify(report).includes('private-raw-change'));
  checks.push('Report period evidence, live snapshot pagination, private audit-field exclusion');

  const refreshed = await form('/oauth/mcp/token', { grant_type: 'refresh_token', client_id: clientId, refresh_token: writeTokens.refresh_token, resource: `${base}/mcp` });
  assert.equal(refreshed.response.status, 200);
  assert.equal((await fetch(`${base}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${writeTokens.access_token}`, 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  const refreshedClient = await connect(refreshed.data.access_token);
  await refreshedClient.listTools();
  assert.equal((await form('/oauth/mcp/token', { grant_type: 'refresh_token', client_id: clientId, refresh_token: writeTokens.refresh_token, resource: `${base}/mcp` })).response.status, 400);
  assert.equal((await fetch(`${base}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${refreshed.data.access_token}`, 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  await prisma.organizationMember.delete({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } } });
  assert.equal((await fetch(`${base}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${readTokens.access_token}`, 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  checks.push('Refresh rotation invalidates prior access, replay revokes family, membership removal blocks access');
  console.log(JSON.stringify({ success: true, checks }, null, 2));
} finally {
  await Promise.all(clients.map(client => client.close().catch(() => undefined)));
  await new Promise<void>(resolve => server.close(() => resolve()));
  await prisma.$disconnect();
}
