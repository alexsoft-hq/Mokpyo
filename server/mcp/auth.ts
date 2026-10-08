import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { getMcpUrl } from './config';
import { McpError, type McpActor } from './types';

export const MCP_SCOPES = ['mokpyo:read', 'mokpyo:write'] as const;
export const hashOpaque = (value: string) => createHash('sha256').update(value).digest('hex');
export function validScopes(scopes: unknown): scopes is string[] {
  return Array.isArray(scopes) && scopes.length > 0 && scopes.length <= 2
    && scopes.includes('mokpyo:read') && new Set(scopes).size === scopes.length
    && scopes.every(scope => MCP_SCOPES.includes(scope as typeof MCP_SCOPES[number]));
}

export async function authenticateMcpToken(token: string): Promise<McpActor> {
  if (!/^mcp_[A-Za-z0-9_-]{43}$/.test(token)) throw new McpError('UNAUTHORIZED', 'Invalid MCP access token');
  const record = await prisma.mcpToken.findUnique({
    where: { tokenHash: hashOpaque(token) }, include: { user: true, client: true },
  });
  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()
      || record.resource !== new URL(getMcpUrl()).href || !record.client || !validScopes(record.scopes)) {
    throw new McpError('UNAUTHORIZED', 'Invalid or expired MCP access token');
  }
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: record.organizationId, userId: record.userId } },
  });
  if (!membership) throw new McpError('UNAUTHORIZED', 'Workspace access has been removed');
  // Conditional update makes concurrent revocation fail closed before returning an actor.
  const active = await prisma.mcpToken.updateMany({ where: { id: record.id, tokenHash: hashOpaque(token), revokedAt: null, expiresAt: { gt: new Date() } }, data: { lastUsedAt: new Date() } });
  if (active.count !== 1) throw new McpError('UNAUTHORIZED', 'MCP access was revoked');
  return { userId: record.userId, userName: record.user.name, organizationId: record.organizationId, tokenId: record.id, scopes: record.scopes };
}
