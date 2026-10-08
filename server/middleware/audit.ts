import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';


export interface AuditInfo {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REORDER';
  entityType: 'Goal' | 'SubGoal' | 'Note' | 'Category' | 'Attachment' | 'Project' | 'Setting';
  entityId: string;
  entityTitle?: string;
  goalId?: string;      // 연관 목표 ID (목표별 이력 조회용)
  projectId?: string;   // 프로젝트 ID (프로젝트별 조회용)
  summary?: string;     // 사람이 읽기 쉬운 요약
  changes?: any;
}

// Attach audit logger to request
export function attachAuditLog(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // IP 주소 추출 (프록시 환경 고려)
  const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0].trim()
    || req.socket.remoteAddress
    || 'unknown';

  // Add audit function to request
  (req as any).audit = async (info: AuditInfo) => {
    try {
      await prisma.auditLog.create({
        data: {
          action: info.action,
          entityType: info.entityType,
          entityId: info.entityId,
          entityTitle: info.entityTitle,
          goalId: info.goalId,
          projectId: info.projectId,
          organizationId: req.organizationId || null,
          summary: info.summary,
          ipAddress,
          userId: req.user?.userId || null,
          changes: info.changes ? JSON.stringify(info.changes) : null,
        },
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  };

  next();
}
