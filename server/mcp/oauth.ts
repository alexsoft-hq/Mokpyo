import { randomBytes, randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import { Prisma } from '@prisma/client';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { mcpAuthMetadataRouter, createOAuthMetadata } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { authorizationHandler, redirectUriMatches } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { clientRegistrationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/register.js';
import { revocationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/revoke.js';
import { InvalidClientMetadataError, InvalidGrantError, InvalidRequestError, InvalidScopeError, InvalidTargetError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { prisma } from '../lib/prisma';
import { authenticateJWT, type AuthRequest } from '../middleware/auth';
import { resolveOrganization } from '../middleware/organization';
import { authenticateMcpToken, hashOpaque, MCP_SCOPES, validScopes } from './auth';
import { getAppUrl, getMcpIssuer, getMcpUrl } from './config';

const opaque = () => randomBytes(32).toString('base64url');
const after = (seconds: number) => new Date(Date.now() + seconds * 1000);
const resourceUrl = () => new URL(getMcpUrl()).href;
const ACCESS_SECONDS = 3600;
const requestSelect = { id: true, clientId: true, redirectUri: true, resource: true, scopes: true, codeChallenge: true, state: true, claimedById: true, expiresAt: true, consumedAt: true } as const;

export function validateRedirectUri(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new InvalidClientMetadataError('Invalid redirect URI'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new InvalidClientMetadataError('Redirect URIs require HTTPS, or HTTP on loopback, with no user information or fragment');
  }
  return value;
}
export function requireResource(resource: URL | undefined): string {
  if (!resource || resource.href !== resourceUrl()) throw new InvalidTargetError('The resource must match the configured MCP endpoint');
  return resource.href;
}
function requestedScopes(scopes?: string[]): string[] {
  const requested = scopes?.length ? scopes : ['mokpyo:read'];
  if (!validScopes(requested)) throw new InvalidScopeError('Use mokpyo:read and optionally mokpyo:write');
  return requested;
}

export const mcpOAuthProvider: OAuthServerProvider = {
  clientsStore: {
    async getClient(clientId) {
      const stored = await prisma.mcpOAuthClient.findUnique({ where: { id: clientId } });
      return stored ? stored.metadata as unknown as OAuthClientInformationFull : undefined;
    },
    async registerClient(input) {
      if (input.token_endpoint_auth_method !== 'none') throw new InvalidClientMetadataError('This server supports public clients with PKCE; use token_endpoint_auth_method=none');
      if (!input.redirect_uris.length || input.redirect_uris.length > 10) throw new InvalidClientMetadataError('Register between one and ten redirect URIs');
      input.redirect_uris.forEach(validateRedirectUri);
      if (input.grant_types?.some(grant => !['authorization_code', 'refresh_token'].includes(grant)) || input.response_types?.some(type => type !== 'code')) throw new InvalidClientMetadataError('Only authorization_code and refresh_token with response_type=code are supported');
      if (input.scope) requestedScopes(input.scope.split(' '));
      if ((input.client_name?.length ?? 0) > 160) throw new InvalidClientMetadataError('Client name is too long');
      // Only retain fields this implementation uses. No remote metadata URLs are fetched.
      const client: OAuthClientInformationFull = {
        client_id: randomUUID(), client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: input.client_name || 'MCP client', redirect_uris: input.redirect_uris,
        token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
        ...(input.scope ? { scope: input.scope } : {}),
      };
      await prisma.mcpOAuthClient.create({ data: { id: client.client_id, metadata: client as unknown as Prisma.InputJsonValue } });
      return client;
    },
  },
  async authorize(client, params: AuthorizationParams, res) {
    const resource = requireResource(params.resource);
    const scopes = requestedScopes(params.scopes);
    if (!client.redirect_uris.some(registered => redirectUriMatches(params.redirectUri, registered))) throw new InvalidRequestError('Redirect URI is not registered');
    validateRedirectUri(params.redirectUri);
    if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) throw new InvalidRequestError('A valid S256 PKCE challenge is required');
    if ((params.state?.length ?? 0) > 1024) throw new InvalidRequestError('State is too long');
    const request = await prisma.mcpOAuthRequest.create({ data: {
      id: opaque(), clientId: client.client_id, redirectUri: params.redirectUri,
      resource, scopes, codeChallenge: params.codeChallenge, state: params.state, expiresAt: after(600),
    } });
    const consent = new URL(`${getAppUrl().replace(/\/$/, '')}/connect/mcp`);
    consent.searchParams.set('request', request.id);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.redirect(consent.href);
  },
  async challengeForAuthorizationCode(client, code) {
    const record = await prisma.mcpOAuthCode.findUnique({ where: { codeHash: hashOpaque(code) } });
    if (!record || record.clientId !== client.client_id || record.consumedAt || record.expiresAt <= new Date()) throw new InvalidGrantError('Invalid authorization code');
    return record.codeChallenge;
  },
  async exchangeAuthorizationCode(client, code, _codeVerifier, redirectUri, resource) {
    const requestedResource = requireResource(resource);
    // SDK tokenHandler validates S256 before this method; never mount a direct exchange route.
    return prisma.$transaction(async tx => {
      const record = await tx.mcpOAuthCode.findUnique({ where: { codeHash: hashOpaque(code) } });
      if (!record || record.clientId !== client.client_id || record.consumedAt || record.expiresAt <= new Date()
          || record.redirectUri !== redirectUri || record.resource !== requestedResource || !validScopes(record.scopes)) throw new InvalidGrantError('Invalid authorization code');
      const membership = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: record.organizationId, userId: record.userId } } });
      if (!membership) throw new InvalidGrantError('Workspace access has been removed');
      const consumed = await tx.mcpOAuthCode.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) throw new InvalidGrantError('Authorization code has already been used');
      const accessToken = `mcp_${opaque()}`;
      const connection = await tx.mcpToken.create({ data: {
        organizationId: record.organizationId, userId: record.userId, name: client.client_name || 'MCP client',
        tokenHash: hashOpaque(accessToken), prefix: accessToken.slice(0, 12), scopes: record.scopes,
        resource: record.resource, clientId: client.client_id, expiresAt: after(ACCESS_SECONDS),
      } });
      const refreshToken = `mcpr_${opaque()}`;
      await tx.mcpRefreshToken.create({ data: { tokenId: connection.id, tokenHash: hashOpaque(refreshToken), expiresAt: after(30 * 24 * 3600) } });
      return { access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer', expires_in: ACCESS_SECONDS, scope: record.scopes.join(' ') };
    });
  },
  async exchangeRefreshToken(client, refreshToken, scopes, resource) {
    const resourceValue = requireResource(resource);
    if (!/^mcpr_[A-Za-z0-9_-]{43}$/.test(refreshToken)) throw new InvalidGrantError('Invalid refresh token');
    const result = await prisma.$transaction(async tx => {
      const refresh = await tx.mcpRefreshToken.findUnique({ where: { tokenHash: hashOpaque(refreshToken) }, include: { token: true } });
      const connection = refresh?.token;
      if (!refresh || !connection || connection.clientId !== client.client_id || connection.resource !== resourceValue
          || connection.revokedAt || refresh.expiresAt <= new Date()) throw new InvalidGrantError('Invalid refresh token');
      if (refresh.consumedAt) {
        // Commit family revocation before reporting replay; throwing here would roll it back.
        await tx.mcpToken.updateMany({ where: { id: connection.id, revokedAt: null }, data: { revokedAt: new Date() } });
        return null;
      }
      const granted = scopes ?? connection.scopes;
      if (!validScopes(granted) || granted.some(scope => !connection.scopes.includes(scope))) throw new InvalidScopeError('Refresh cannot expand granted scopes');
      const member = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: connection.organizationId, userId: connection.userId } } });
      if (!member) throw new InvalidGrantError('Workspace access has been removed');
      const consumed = await tx.mcpRefreshToken.updateMany({ where: { id: refresh.id, consumedAt: null }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) {
        await tx.mcpToken.updateMany({ where: { id: connection.id, revokedAt: null }, data: { revokedAt: new Date() } });
        return null;
      }
      const accessToken = `mcp_${opaque()}`;
      const nextRefresh = `mcpr_${opaque()}`;
      const expiresAt = new Date(Math.min(after(ACCESS_SECONDS).getTime(), refresh.expiresAt.getTime()));
      const rotated = await tx.mcpToken.updateMany({ where: { id: connection.id, revokedAt: null }, data: { tokenHash: hashOpaque(accessToken), prefix: accessToken.slice(0, 12), scopes: granted, expiresAt } });
      if (rotated.count !== 1) throw new InvalidGrantError('Connection was revoked');
      await tx.mcpRefreshToken.create({ data: { tokenId: connection.id, tokenHash: hashOpaque(nextRefresh), expiresAt: refresh.expiresAt } });
      return { access_token: accessToken, refresh_token: nextRefresh, token_type: 'Bearer', expires_in: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)), scope: granted.join(' ') };
    });
    if (!result) throw new InvalidGrantError('Refresh token replay detected; reconnect to authorize again');
    return result;
  },
  async verifyAccessToken(token) {
    const actor = await authenticateMcpToken(token);
    const record = await prisma.mcpToken.findUniqueOrThrow({ where: { id: actor.tokenId } });
    return { token, clientId: record.clientId, scopes: actor.scopes, expiresAt: Math.floor(record.expiresAt.getTime() / 1000), resource: new URL(record.resource) };
  },
  async revokeToken(client, request) {
    const tokenHash = hashOpaque(request.token);
    const refresh = await prisma.mcpRefreshToken.findUnique({ where: { tokenHash }, select: { tokenId: true } });
    await prisma.mcpToken.updateMany({ where: { clientId: client.client_id, revokedAt: null, OR: [{ tokenHash }, ...(refresh ? [{ id: refresh.tokenId }] : [])] }, data: { revokedAt: new Date() } });
  },
};

export function mountMcpAuth(app: Express): void {
  const issuerUrl = new URL(getMcpIssuer());
  const metadata = createOAuthMetadata({ provider: mcpOAuthProvider, issuerUrl, scopesSupported: [...MCP_SCOPES] });
  // The SDK's generic metadata advertises refresh/confidential clients; publish actual capabilities.
  metadata.authorization_endpoint = new URL('/oauth/mcp/authorize', issuerUrl).href;
  metadata.token_endpoint = new URL('/oauth/mcp/token', issuerUrl).href;
  metadata.registration_endpoint = new URL('/oauth/mcp/register', issuerUrl).href;
  metadata.revocation_endpoint = new URL('/oauth/mcp/revoke', issuerUrl).href;
  metadata.grant_types_supported = ['authorization_code', 'refresh_token'];
  metadata.token_endpoint_auth_methods_supported = ['none'];
  metadata.revocation_endpoint_auth_methods_supported = ['none'];
  app.use(mcpAuthMetadataRouter({ oauthMetadata: metadata, resourceServerUrl: new URL(getMcpUrl()), scopesSupported: [...MCP_SCOPES], resourceName: 'Mokpyo workspace' }));
  app.use('/oauth/mcp/authorize', authorizationHandler({ provider: mcpOAuthProvider }));
  app.use('/oauth/mcp/token', tokenHandler({ provider: mcpOAuthProvider }));
  app.use('/oauth/mcp/register', clientRegistrationHandler({ clientsStore: mcpOAuthProvider.clientsStore }));
  app.use('/oauth/mcp/revoke', revocationHandler({ provider: mcpOAuthProvider }));

  const consent = express.Router();
  consent.use((req, res, next) => { authenticateJWT(req as unknown as AuthRequest, res, next); });
  consent.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
  consent.get('/:requestId', async (request, res) => {
    const req = request as unknown as AuthRequest;
    const requestId = String(req.params.requestId);
    if (!/^[A-Za-z0-9_-]{43}$/.test(requestId)) return res.status(404).json({ error: 'Consent request not found' });
    // Atomic first-authenticated-user claim; a copied URL cannot be approved by another user later.
    const claimed = await prisma.mcpOAuthRequest.updateMany({ where: {
      id: requestId, consumedAt: null, expiresAt: { gt: new Date() },
      OR: [{ claimedById: null }, { claimedById: req.user!.userId }],
    }, data: { claimedById: req.user!.userId } });
    if (claimed.count !== 1) return res.status(404).json({ error: 'Consent request expired, used, or unavailable' });
    const pending = await prisma.mcpOAuthRequest.findUniqueOrThrow({ where: { id: requestId }, include: { client: true } });
    const client = pending.client.metadata as unknown as OAuthClientInformationFull;
    return res.json({ clientName: client.client_name || 'MCP client', redirectHost: new URL(pending.redirectUri).host, requestedScopes: pending.scopes, expiresAt: pending.expiresAt });
  });
  consent.post('/:requestId', express.json({ limit: '8kb' }), async (request, res) => {
    const req = request as unknown as AuthRequest;
    const requestId = String(req.params.requestId);
    const { organizationId, scopes, approved } = req.body ?? {};
    if (!/^[A-Za-z0-9_-]{43}$/.test(requestId) || typeof approved !== 'boolean') return res.status(400).json({ error: 'Invalid consent request' });
    if (approved && (typeof organizationId !== 'string' || !validScopes(scopes))) return res.status(400).json({ error: 'Select a workspace and valid scopes' });
    try {
      const redirectUrl = await prisma.$transaction(async tx => {
        const pending = await tx.mcpOAuthRequest.findUnique({ where: { id: requestId }, select: requestSelect });
        if (!pending || pending.claimedById !== req.user!.userId || pending.consumedAt || pending.expiresAt <= new Date() || pending.resource !== resourceUrl()) throw new InvalidGrantError('Consent request expired, used, or unavailable');
        const client = await tx.mcpOAuthClient.findUnique({ where: { id: pending.clientId } });
        const clientInfo = client?.metadata as unknown as OAuthClientInformationFull | undefined;
        if (!clientInfo?.redirect_uris.some(registered => redirectUriMatches(pending.redirectUri, registered))) throw new InvalidGrantError('Client is no longer registered');
        validateRedirectUri(pending.redirectUri);
        if (approved) {
          if (scopes.some((scope: string) => !pending.scopes.includes(scope))) throw new InvalidScopeError('Consent cannot expand the requested scopes');
          const membership = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: req.user!.userId } } });
          if (!membership) throw new InvalidGrantError('You are not a member of this workspace');
        }
        const consumed = await tx.mcpOAuthRequest.updateMany({ where: { id: requestId, claimedById: req.user!.userId, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
        if (consumed.count !== 1) throw new InvalidGrantError('Consent was already used');
        const redirect = new URL(pending.redirectUri);
        // Never carry attacker-supplied stale OAuth response parameters through the callback.
        ['code', 'error', 'error_description', 'state'].forEach(key => redirect.searchParams.delete(key));
        if (pending.state !== null) redirect.searchParams.set('state', pending.state);
        if (!approved) redirect.searchParams.set('error', 'access_denied');
        else {
          const code = opaque();
          await tx.mcpOAuthCode.create({ data: { codeHash: hashOpaque(code), clientId: pending.clientId, userId: req.user!.userId, organizationId, redirectUri: pending.redirectUri, resource: pending.resource, scopes, codeChallenge: pending.codeChallenge, expiresAt: after(120) } });
          redirect.searchParams.set('code', code);
        }
        return redirect.href;
      });
      return res.json({ redirectUrl });
    } catch (error) {
      if (error instanceof InvalidGrantError || error instanceof InvalidScopeError || error instanceof InvalidClientMetadataError) return res.status(400).json({ error: error.message });
      throw error;
    }
  });
  app.use('/api/mcp/consent', consent);
  const connections = express.Router();
  connections.use((req, res, next) => { authenticateJWT(req as unknown as AuthRequest, res, next); }, (req, res, next) => { resolveOrganization(req as unknown as AuthRequest, res, next); });
  connections.get('/', async (request, res) => {
    const req = request as unknown as AuthRequest;
    const records = await prisma.mcpToken.findMany({ where: { organizationId: req.organizationId!, userId: req.user!.userId }, select: { id: true, name: true, scopes: true, createdAt: true, expiresAt: true, lastUsedAt: true, revokedAt: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ connections: records, endpoint: getMcpUrl() });
  });
  connections.delete('/:id', async (request, res) => {
    const req = request as unknown as AuthRequest;
    const result = await prisma.mcpToken.updateMany({ where: { id: String(req.params.id), userId: req.user!.userId, organizationId: req.organizationId!, revokedAt: null }, data: { revokedAt: new Date() } });
    return res.status(result.count ? 204 : 404).end();
  });
  app.use('/api/mcp/connections', connections);
}
