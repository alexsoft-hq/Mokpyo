import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const db = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() });
  return { mcpToken: model(), mcpOAuthClient: model(), mcpOAuthRequest: model(), mcpOAuthCode: model(), mcpRefreshToken: model(), organizationMember: model(), $transaction: vi.fn() };
});
vi.mock('../lib/prisma', () => ({ prisma: db }));
vi.mock('./config', () => ({ getMcpUrl: () => 'https://mokpyo.example/mcp', getMcpIssuer: () => 'https://mokpyo.example', getAppUrl: () => 'https://app.example' }));
vi.mock('../middleware/auth', () => ({ authenticateJWT: (req: Request, res: Response, next: NextFunction) => {
  const user = req.headers['x-test-user'];
  if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
  Object.assign(req, { user: { userId: String(user), name: 'User', email: 'user@example.invalid' } }); next();
} }));
vi.mock('../middleware/organization', () => ({ resolveOrganization: (req: Request, _res: Response, next: NextFunction) => { Object.assign(req, { organizationId: 'org' }); next(); } }));
import { authenticateMcpToken, hashOpaque } from './auth';
import { mcpOAuthProvider as provider, mountMcpAuth, validateRedirectUri } from './oauth';

const resource = new URL('https://mokpyo.example/mcp');
const token = `mcp_${'a'.repeat(43)}`;
const refreshToken = `mcpr_${'b'.repeat(43)}`;
const requestId = 'c'.repeat(43);
const client = { client_id: 'client', client_name: 'Test client', redirect_uris: ['https://client.example/callback'], token_endpoint_auth_method: 'none' as const, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] };
const verifier = 'v'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
const future = () => new Date(Date.now() + 60_000);
const tokenRecord = () => ({ id: 'token', organizationId: 'org', userId: 'user', clientId: 'client', resource: resource.href, scopes: ['mokpyo:read'], expiresAt: future(), revokedAt: null, user: { name: 'User' }, client });
const codeRecord = () => ({ id: 'code', codeHash: hashOpaque('code'), clientId: 'client', organizationId: 'org', userId: 'user', scopes: ['mokpyo:read'], redirectUri: client.redirect_uris[0], resource: resource.href, expiresAt: future(), consumedAt: null, codeChallenge: challenge });
const pending = () => ({ id: requestId, clientId: 'client', redirectUri: client.redirect_uris[0], resource: resource.href, scopes: ['mokpyo:read', 'mokpyo:write'], codeChallenge: challenge, state: 'original-state', claimedById: 'user', expiresAt: future(), consumedAt: null, client: { metadata: client } });
const app = () => { const app = express(); app.use(express.json()); mountMcpAuth(app); return app; };

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(fn => fn(db));
  db.organizationMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
  db.mcpToken.findUnique.mockResolvedValue(tokenRecord());
  db.mcpToken.create.mockResolvedValue({ id: 'token' });
  db.mcpToken.updateMany.mockResolvedValue({ count: 1 });
  db.mcpOAuthClient.findUnique.mockResolvedValue({ id: 'client', metadata: client });
  db.mcpOAuthCode.findUnique.mockResolvedValue(codeRecord());
  db.mcpOAuthCode.updateMany.mockResolvedValue({ count: 1 });
  db.mcpOAuthRequest.findUnique.mockResolvedValue(pending());
  db.mcpOAuthRequest.findUniqueOrThrow.mockResolvedValue(pending());
  db.mcpOAuthRequest.updateMany.mockResolvedValue({ count: 1 });
  db.mcpRefreshToken.findUnique.mockResolvedValue({ id: 'refresh', tokenId: 'token', consumedAt: null, expiresAt: future(), token: tokenRecord() });
  db.mcpRefreshToken.updateMany.mockResolvedValue({ count: 1 });
});

describe('MCP opaque authentication', () => {
  it('accepts a member and never derives workspace from request headers', async () => {
    await expect(authenticateMcpToken(token)).resolves.toEqual({ userId: 'user', userName: 'User', organizationId: 'org', tokenId: 'token', scopes: ['mokpyo:read'] });
    expect(db.mcpToken.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashOpaque(token) } }));
    expect(db.mcpToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tokenHash: hashOpaque(token) }) }));
  });
  it('rejects browser JWTs before querying persistence', async () => {
    await expect(authenticateMcpToken('eyJ.browser.jwt')).rejects.toThrow('Invalid MCP');
    expect(db.mcpToken.findUnique).not.toHaveBeenCalled();
  });
  it.each([
    { revokedAt: new Date() }, { expiresAt: new Date(0) }, { resource: 'https://other.example/mcp' },
    { scopes: ['mokpyo:write'] }, { scopes: ['mokpyo:read', 'admin'] }, { client: null },
  ])('rejects invalid token state %j', async patch => {
    db.mcpToken.findUnique.mockResolvedValue({ ...tokenRecord(), ...patch });
    await expect(authenticateMcpToken(token)).rejects.toThrow('Invalid or expired');
  });
  it('rejects unknown tokens and removed memberships', async () => {
    db.mcpToken.findUnique.mockResolvedValueOnce(null);
    await expect(authenticateMcpToken(token)).rejects.toThrow();
    db.organizationMember.findUnique.mockResolvedValue(null);
    await expect(authenticateMcpToken(token)).rejects.toThrow('Workspace access');
  });
  it('fails closed when revocation wins the final conditional update', async () => {
    db.mcpToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(authenticateMcpToken(token)).rejects.toThrow('revoked');
  });
});

describe('OAuth protocol and consent', () => {
  it.each(['http://evil.example/cb', 'https://name:password@client.example/cb', 'https://client.example/cb#fragment', 'javascript:alert(1)', 'http://127.0.0.1.evil.example/cb'])('rejects unsafe redirect %s', value => {
    expect(() => validateRedirectUri(value)).toThrow();
  });
  it.each(['https://client.example/callback', 'http://localhost:1234/cb', 'http://127.0.0.1/cb', 'http://[::1]:1234/cb'])('accepts permitted redirect %s', value => {
    expect(validateRedirectUri(value)).toBe(value);
  });
  it('registers public clients without secrets or remote metadata fetches', async () => {
    const response = await request(app()).post('/oauth/mcp/register').send({ client_name: 'Test', redirect_uris: client.redirect_uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'] });
    expect(response.status).toBe(201);
    expect(response.body.client_secret).toBeUndefined();
    expect(db.mcpOAuthClient.create).toHaveBeenCalledTimes(1);
  });
  it('accepts an ephemeral loopback port through authorization and consent, recording it exactly', async () => {
    const loopbackClient = { ...client, redirect_uris: ['http://127.0.0.1:3000/callback'] };
    const ephemeral = 'http://127.0.0.1:49152/callback';
    db.mcpOAuthClient.findUnique.mockResolvedValue({ id: 'client', metadata: loopbackClient });
    db.mcpOAuthRequest.create.mockResolvedValue({ id: requestId });
    const authorize = await request(app()).get('/oauth/mcp/authorize').query({ client_id: 'client', response_type: 'code', redirect_uri: ephemeral, code_challenge: challenge, code_challenge_method: 'S256', scope: 'mokpyo:read', resource: resource.href });
    expect(authorize.status).toBe(302);
    expect(new URL(authorize.headers.location).pathname).toBe('/connect/mcp');
    expect(db.mcpOAuthRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ redirectUri: ephemeral }) });
    db.mcpOAuthRequest.findUnique.mockResolvedValue({ ...pending(), redirectUri: ephemeral });
    const consent = await request(app()).post(`/api/mcp/consent/${requestId}`).set('x-test-user', 'user').send({ approved: true, organizationId: 'org', scopes: ['mokpyo:read'] });
    expect(consent.status).toBe(200);
    expect(new URL(consent.body.redirectUrl).origin).toBe('http://127.0.0.1:49152');
    expect(db.mcpOAuthCode.create).toHaveBeenCalledWith({ data: expect.objectContaining({ redirectUri: ephemeral }) });
    db.mcpOAuthCode.findUnique.mockResolvedValue({ ...codeRecord(), redirectUri: ephemeral });
    await expect(provider.exchangeAuthorizationCode(loopbackClient, 'code', undefined, loopbackClient.redirect_uris[0], resource)).rejects.toThrow('Invalid authorization code');
    expect(db.mcpToken.create).not.toHaveBeenCalled();
  });
  it('rejects a different non-loopback callback port at authorization and consent', async () => {
    const differentPort = 'https://client.example:9443/callback';
    const authorize = await request(app()).get('/oauth/mcp/authorize').query({ client_id: 'client', response_type: 'code', redirect_uri: differentPort, code_challenge: challenge, code_challenge_method: 'S256', resource: resource.href });
    expect(authorize.status).toBe(400);
    expect(db.mcpOAuthRequest.create).not.toHaveBeenCalled();
    db.mcpOAuthRequest.findUnique.mockResolvedValue({ ...pending(), redirectUri: differentPort });
    const consent = await request(app()).post(`/api/mcp/consent/${requestId}`).set('x-test-user', 'user').send({ approved: true, organizationId: 'org', scopes: ['mokpyo:read'] });
    expect(consent.status).toBe(400);
    expect(db.mcpOAuthCode.create).not.toHaveBeenCalled();
  });
  it('publishes actual resource and supported grants', async () => {
    const metadata = await request(app()).get('/.well-known/oauth-authorization-server');
    expect(metadata.body.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(metadata.body.grant_types_supported).toContain('refresh_token');
    const resourceMetadata = await request(app()).get('/.well-known/oauth-protected-resource/mcp');
    expect(resourceMetadata.body.resource).toBe(resource.href);
  });
  it('requires authentication before disclosing or approving consent', async () => {
    expect((await request(app()).get(`/api/mcp/consent/${requestId}`)).status).toBe(401);
    expect(db.mcpOAuthRequest.updateMany).not.toHaveBeenCalled();
  });
  it('claims consent atomically and returns only consent display information', async () => {
    const response = await request(app()).get(`/api/mcp/consent/${requestId}`).set('x-test-user', 'user');
    expect(response.status).toBe(200);
    expect(response.body.redirectHost).toBe('client.example');
    expect(response.body.codeChallenge).toBeUndefined();
    expect(db.mcpOAuthRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: [{ claimedById: null }, { claimedById: 'user' }] }) }));
  });
  it('rejects an already-claimed URL belonging to someone else', async () => {
    db.mcpOAuthRequest.updateMany.mockResolvedValue({ count: 0 });
    expect((await request(app()).get(`/api/mcp/consent/${requestId}`).set('x-test-user', 'attacker')).status).toBe(404);
    db.mcpOAuthRequest.findUnique.mockResolvedValue({ ...pending(), claimedById: 'other' });
    expect((await request(app()).post(`/api/mcp/consent/${requestId}`).set('x-test-user', 'user').send({ approved: true, organizationId: 'org', scopes: ['mokpyo:read'] })).status).toBe(400);
    expect(db.mcpOAuthCode.create).not.toHaveBeenCalled();
  });
  it.each(['nonmember', 'expanded-scope', 'replay', 'expired'])('rejects unsafe consent %s', async kind => {
    if (kind === 'nonmember') db.organizationMember.findUnique.mockResolvedValue(null);
    if (kind === 'expanded-scope') db.mcpOAuthRequest.findUnique.mockResolvedValue({ ...pending(), scopes: ['mokpyo:read'] });
    if (kind === 'replay') db.mcpOAuthRequest.updateMany.mockResolvedValue({ count: 0 });
    if (kind === 'expired') db.mcpOAuthRequest.findUnique.mockResolvedValue({ ...pending(), expiresAt: new Date(0) });
    const response = await request(app()).post(`/api/mcp/consent/${requestId}`).set('x-test-user', 'user').send({ approved: true, organizationId: 'org', scopes: ['mokpyo:read', 'mokpyo:write'] });
    expect(response.status).toBe(400);
    expect(db.mcpOAuthCode.create).not.toHaveBeenCalled();
  });
  it('creates a hashed code only after explicit scoped consent', async () => {
    const response = await request(app()).post(`/api/mcp/consent/${requestId}`).set('x-test-user', 'user').send({ approved: true, organizationId: 'org', scopes: ['mokpyo:read'] });
    expect(response.status).toBe(200);
    const redirect = new URL(response.body.redirectUrl);
    expect(redirect.searchParams.get('state')).toBe('original-state');
    const raw = redirect.searchParams.get('code')!;
    expect(db.mcpOAuthCode.create).toHaveBeenCalledWith({ data: expect.objectContaining({ codeHash: hashOpaque(raw), scopes: ['mokpyo:read'], organizationId: 'org', userId: 'user' }) });
    expect(db.mcpToken.create).not.toHaveBeenCalled();
  });
  it('denies consent through the validated callback without minting a code', async () => {
    const response = await request(app()).post(`/api/mcp/consent/${requestId}`).set('x-test-user', 'user').send({ approved: false });
    expect(new URL(response.body.redirectUrl).searchParams.get('error')).toBe('access_denied');
    expect(db.mcpOAuthCode.create).not.toHaveBeenCalled();
  });
  it('rejects wrong PKCE through the official SDK token handler', async () => {
    const response = await request(app()).post('/oauth/mcp/token').type('form').send({ grant_type: 'authorization_code', client_id: 'client', code: 'code', code_verifier: 'x'.repeat(43), redirect_uri: client.redirect_uris[0], resource: resource.href });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_grant');
    expect(db.mcpToken.create).not.toHaveBeenCalled();
  });
  it('exchanges correct PKCE through the SDK and stores only hashed tokens', async () => {
    const response = await request(app()).post('/oauth/mcp/token').type('form').send({ grant_type: 'authorization_code', client_id: 'client', code: 'code', code_verifier: verifier, redirect_uri: client.redirect_uris[0], resource: resource.href });
    expect(response.status).toBe(200);
    expect(response.body.access_token).toMatch(/^mcp_/);
    expect(response.body.refresh_token).toMatch(/^mcpr_/);
    expect(db.mcpToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tokenHash: hashOpaque(response.body.access_token) }) });
    expect(db.mcpRefreshToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tokenHash: hashOpaque(response.body.refresh_token) }) });
  });
  it.each(['resource', 'redirect', 'client', 'consumed', 'atomic-replay'])('rejects code exchange with invalid %s', async kind => {
    if (kind === 'client') db.mcpOAuthCode.findUnique.mockResolvedValue({ ...codeRecord(), clientId: 'other' });
    if (kind === 'consumed') db.mcpOAuthCode.findUnique.mockResolvedValue({ ...codeRecord(), consumedAt: new Date() });
    if (kind === 'atomic-replay') db.mcpOAuthCode.updateMany.mockResolvedValue({ count: 0 });
    await expect(provider.exchangeAuthorizationCode(client, 'code', undefined, kind === 'redirect' ? 'https://evil.example' : client.redirect_uris[0], kind === 'resource' ? new URL('https://other.example/mcp') : resource)).rejects.toThrow();
    expect(db.mcpToken.create).not.toHaveBeenCalled();
  });
});

describe('Refresh rotation and revocation', () => {
  it('rotates both hashes while preserving the fixed refresh expiration', async () => {
    const expiresAt = future();
    db.mcpRefreshToken.findUnique.mockResolvedValue({ id: 'refresh', consumedAt: null, expiresAt, token: tokenRecord() });
    const result = await provider.exchangeRefreshToken(client, refreshToken, undefined, resource);
    expect(result.refresh_token).not.toBe(refreshToken);
    expect(db.mcpToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tokenHash: hashOpaque(result.access_token) }) }));
    expect(db.mcpRefreshToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ expiresAt, tokenHash: hashOpaque(result.refresh_token!) }) });
  });
  it('revokes the whole connection when a consumed refresh token is replayed', async () => {
    db.mcpRefreshToken.findUnique.mockResolvedValue({ id: 'refresh', consumedAt: new Date(), expiresAt: future(), token: tokenRecord() });
    await expect(provider.exchangeRefreshToken(client, refreshToken, undefined, resource)).rejects.toThrow('replay');
    expect(db.mcpToken.updateMany).toHaveBeenCalledWith({ where: { id: 'token', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(db.mcpRefreshToken.create).not.toHaveBeenCalled();
  });
  it('revokes on a concurrent rotation replay', async () => {
    db.mcpRefreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(provider.exchangeRefreshToken(client, refreshToken, undefined, resource)).rejects.toThrow('replay');
    expect(db.mcpRefreshToken.create).not.toHaveBeenCalled();
  });
  it('rejects refresh scope escalation and removed members', async () => {
    await expect(provider.exchangeRefreshToken(client, refreshToken, ['mokpyo:read', 'mokpyo:write'], resource)).rejects.toThrow('expand');
    db.organizationMember.findUnique.mockResolvedValue(null);
    await expect(provider.exchangeRefreshToken(client, refreshToken, undefined, resource)).rejects.toThrow('Workspace');
  });
  it('rejects a refresh token issued to another client or resource', async () => {
    await expect(provider.exchangeRefreshToken({ ...client, client_id: 'other' }, refreshToken, undefined, resource)).rejects.toThrow();
    await expect(provider.exchangeRefreshToken(client, refreshToken, undefined, new URL('https://evil.example/mcp'))).rejects.toThrow();
  });
  it('supports client-bound family revocation using a refresh token', async () => {
    await provider.revokeToken!(client, { token: refreshToken });
    expect(db.mcpToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ clientId: 'client', OR: [{ tokenHash: hashOpaque(refreshToken) }, { id: 'token' }] }) }));
  });
});
