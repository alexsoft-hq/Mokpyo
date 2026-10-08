import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from './auth';


export function resolveOrganization(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const orgId = req.headers['x-organization-id'] as string;

  if (!orgId) {
    return res.status(400).json({ error: 'X-Organization-Id header is required' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: req.user.userId,
      },
    },
  }).then((membership) => {
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    req.organizationId = orgId;
    req.memberRole = membership.role;
    next();
  }).catch((error) => {
    console.error('Error resolving organization:', error);
    res.status(500).json({ error: 'Failed to resolve organization' });
  });
}
