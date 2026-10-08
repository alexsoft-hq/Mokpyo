import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { prisma } from './lib/prisma';
import { requireRole, findProjectInOrg, findGoalInOrg, findCategoryInOrg, findAttachmentInOrg, findReportTemplateInOrg, findCycleInOrg, buildOwnerNameToUserId, getOrgMemberIds } from './lib/tenancy';
import { setupPassport } from './auth/passport';
import authRoutes from './routes/auth';
import accountRoutes from './routes/account';
import organizationRoutes from './routes/organizations';
import invitationRoutes from './routes/invitations';
import notificationRoutes from './routes/notifications';
import cycleRoutes from './routes/cycles';
import fieldsRoutes from './routes/fields';
import goalsPatchRoutes from './routes/goals-patch';
import commentRoutes from './routes/comments';
import viewRoutes from './routes/views';
import automationRoutes from './routes/automations';
import { emitDomainEvent } from './services/automation/engine';
import { startAutomationScheduler } from './services/automation/scheduler';
import { resolveInitialStatus, syncStatusFromFlags, resyncAllGoalStatuses } from './lib/statusSync';
import { validateAndMergeFieldValues } from './lib/customFieldValues';
import { createAssignmentNotifications, startDueSoonScheduler } from './lib/notifications';
import { authenticateJWT, AuthRequest } from './middleware/auth';
import { resolveOrganization } from './middleware/organization';
import { attachAuditLog } from './middleware/audit';
import { buildChangesData } from './utils/changeTracker';
import { buildNoteUpdateData } from './utils/noteUpdateHelper';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { validateEnv, resolveUploadsDir, corsOptions, APP_VERSION } from './lib/env';
import { checkLimit, getPlan, getOrgUsage } from './lib/plans';
import multer from 'multer';
import { createStorageAdapter, decodeMultipartFilename } from './utils/storage';
import { isAIAvailable, chatCompletion, chatCompletionStream, compressAuditLogs, formatGoalsForPrompt } from './utils/aiService';
import pdfParse from 'pdf-parse';

// 단일 앱 모듈. server/index.ts(개발, tsx ESM)와 server/production.ts(운영, esbuild CJS 번들) 둘 다
// 이 파일을 import 한다 — 엔드포인트·미들웨어는 여기 한 곳에만 둔다.
validateEnv();

export const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Storage adapter (local or S3 based on STORAGE_TYPE env)
const uploadsDir = resolveUploadsDir();
const storageAdapter = createStorageAdapter(uploadsDir);

// 실행 파일·스크립트류는 첨부로 받지 않는다(멀웨어 유포 경로 차단). 그 외 문서·이미지·압축은 허용.
const BLOCKED_UPLOAD_EXTENSIONS = new Set(['.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.ps1', '.jar', '.dll', '.apk']);

const upload = multer({
  storage: storageAdapter.getMulterStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(decodeMultipartFilename(file.originalname)).toLowerCase();
    if (BLOCKED_UPLOAD_EXTENSIONS.has(ext)) {
      return cb(new Error(`보안상 ${ext} 파일은 첨부할 수 없습니다.`));
    }
    cb(null, true);
  }
});

// Setup Passport
setupPassport();

// nginx 등 리버스 프록시 뒤에서 실제 클라이언트 IP로 rate limit 을 걸기 위한 설정(TRUST_PROXY=1).
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use(helmet({
  // SPA 는 nginx 가 별도 서빙하고 이 서버는 JSON API 위주 — CSP 는 프론트 쪽에서 관리한다.
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions()));
app.use(express.json({ limit: '2mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false' },
  })
);

// Rate limiting — 인증 엔드포인트는 무차별 대입 방어를 위해 훨씬 엄격하게.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_PER_15MIN) || 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 15분 후 다시 시도해주세요.' },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MIN) || 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/verify-email', '/api/auth/resend-verification', '/api/auth/forgot-password', '/api/auth/reset-password'], authLimiter);
app.use('/api', apiLimiter);
app.use(passport.initialize());
app.use(passport.session());

// Account self-service (auth required) — /api/auth 보다 먼저 등록해 경로 우선순위 보장
app.use('/api/auth/account', authenticateJWT, accountRoutes);

// Auth routes (no authentication required)
app.use('/api/auth', authRoutes);

// Health check (no authentication required)
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', version: APP_VERSION, uptime: Math.round(process.uptime()) });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ status: 'degraded', version: APP_VERSION, error: 'database unreachable' });
  }
});

// Invitation routes (public GET, auth required for accept/cancel)
app.use('/api/invitations', invitationRoutes);

// Organization management routes (auth required, no org context needed)
app.use('/api/organizations', authenticateJWT, organizationRoutes);
app.use('/api/notifications', authenticateJWT, resolveOrganization, notificationRoutes);
app.use('/api/cycles', authenticateJWT, resolveOrganization, cycleRoutes);

// Apply authentication, organization resolution, and audit middleware to all other API routes
app.use('/api', authenticateJWT, resolveOrganization, attachAuditLog);

// Work-management routers (custom fields/status labels, goal PATCH) — inherit the
// auth+org+audit pipeline registered above. Paths are distinct from the inline
// /api/goals/:id routes below (extra segment or different verb), so no conflict.
app.use('/api', fieldsRoutes);
app.use('/api', goalsPatchRoutes);
app.use('/api/goals/:goalId/comments', commentRoutes);
app.use('/api/views', viewRoutes);
app.use('/api/automations', automationRoutes);

// Helper functions for project hierarchy
async function isDescendant(targetId: string, ancestorId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: targetId },
    select: { parentId: true }
  });

  if (!project || !project.parentId) return false;
  if (project.parentId === ancestorId) return true;

  return isDescendant(project.parentId, ancestorId);
}

async function getDescendantIds(projectId: string): Promise<string[]> {
  const children = await prisma.project.findMany({
    where: { parentId: projectId },
    select: { id: true }
  });

  const childIds = children.map(c => c.id);
  const descendantIds = await Promise.all(
    childIds.map(id => getDescendantIds(id))
  );

  return [...childIds, ...descendantIds.flat()];
}

// SubGoal 정량 지표(Key Result) 진행률 자동 산출: target/current/start가 유효하면 비율(0-100)로,
// 아니면 명시적 progress(없으면 0)로 폴백한다.
function computeSubGoalProgress(sg: any): number {
  const t = sg.targetValue, s = sg.startValue ?? 0, c = sg.currentValue;
  if (t !== undefined && t !== null && c !== undefined && c !== null && t !== s) {
    const pct = Math.round(((c - s) / (t - s)) * 100);
    return Math.max(0, Math.min(100, pct));
  }
  return typeof sg.progress === 'number' ? sg.progress : 0;
}

// Project endpoints
app.get('/api/projects', async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { name: 'asc' },
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/api/projects', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;

    const { name, description, dashboardTitle, dashboardSubtitle, parentId } = req.body;

    // 플랜 한도(프로젝트 수). 베타에서는 PLAN_ENFORCEMENT=true 일 때만 강제.
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! }, select: { plan: true } });
    const limit = checkLimit('projects', getPlan(org?.plan), await getOrgUsage(req.organizationId!));
    if (!limit.ok) {
      return res.status(402).json({ error: limit.message, code: 'PLAN_LIMIT', limit: limit.limit, current: limit.current });
    }

    // Validate parentId if provided
    if (parentId) {
      const parent = await findProjectInOrg(parentId, req.organizationId!);
      if (!parent) {
        return res.status(400).json({ error: 'Parent project not found' });
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        dashboardTitle: dashboardTitle || 'Mokpyo',
        dashboardSubtitle: dashboardSubtitle || '',
        parentId: parentId || null,
        organizationId: req.organizationId!,
      },
    });

    // Audit log
    await (req as any).audit?.({
      action: 'CREATE',
      entityType: 'Project',
      entityId: project.id,
      entityTitle: project.name,
      projectId: project.id,
      summary: `프로젝트 '${project.name}' 생성`,
    });

    res.json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.put('/api/projects/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;

    const { id } = req.params;
    const { name, description, dashboardTitle, dashboardSubtitle, parentId } = req.body;

    if (!(await findProjectInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate circular reference
    if (parentId !== undefined && parentId !== null) {
      if (parentId === id) {
        return res.status(400).json({ error: 'Cannot set project as its own parent' });
      }

      const isCircular = await isDescendant(parentId, id);
      if (isCircular) {
        return res.status(400).json({
          error: 'Cannot set descendant as parent (circular reference)'
        });
      }

      if (!(await findProjectInOrg(parentId, req.organizationId!))) {
        return res.status(400).json({ error: 'Parent project not found' });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (dashboardTitle !== undefined) updateData.dashboardTitle = dashboardTitle;
    if (dashboardSubtitle !== undefined) updateData.dashboardSubtitle = dashboardSubtitle;
    if (parentId !== undefined) updateData.parentId = parentId;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await (req as any).audit?.({
      action: 'UPDATE',
      entityType: 'Project',
      entityId: project.id,
      entityTitle: project.name,
      projectId: project.id,
      summary: `프로젝트 '${project.name}' 수정`,
    });

    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Only ADMIN or OWNER can delete projects
    if (req.memberRole === 'MEMBER') {
      return res.status(403).json({ error: '프로젝트 삭제는 관리자 이상만 가능합니다.' });
    }

    const { id } = req.params;
    const { confirmName } = (req.body || {}) as { confirmName?: string };

    const project = await findProjectInOrg(id, req.organizationId!);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 실수 방지: 프로젝트 이름을 정확히 입력해야 삭제된다(과거의 전역 ADMIN_PASSWORD 방식은 멀티테넌트에 맞지 않아 폐기).
    if ((confirmName || '').trim() !== project.name) {
      return res.status(400).json({ error: '확인을 위해 프로젝트 이름을 정확히 입력해주세요.', code: 'CONFIRM_NAME_MISMATCH' });
    }

    // Check for child projects
    const childrenCount = await prisma.project.count({
      where: { parentId: id }
    });

    if (childrenCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete project with child projects',
        details: `This project has ${childrenCount} child project(s). Please delete or move them first.`
      });
    }

    // This will cascade delete all related goals, categories, etc.
    await prisma.project.delete({
      where: { id },
    });

    // Audit log
    await (req as any).audit?.({
      action: 'DELETE',
      entityType: 'Project',
      entityId: id,
      entityTitle: project?.name || 'Unknown',
      projectId: id,
      summary: `프로젝트 '${project?.name || 'Unknown'}' 삭제`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Categories endpoints
app.get('/api/categories', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    if (!(await findProjectInOrg(projectId, req.organizationId!))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const includeDescendants = req.query.includeDescendants === 'true';

    let projectIds = [projectId];
    if (includeDescendants) {
      const descendants = await getDescendantIds(projectId);
      projectIds = [projectId, ...descendants];
    }

    const categories = await prisma.category.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.post('/api/categories', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;

    const { name, color, projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    if (!(await findProjectInOrg(projectId, req.organizationId!))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const category = await prisma.category.create({
      data: { name, color, projectId },
    });

    // Audit log
    await (req as any).audit?.({
      action: 'CREATE',
      entityType: 'Category',
      entityId: category.id,
      entityTitle: category.name,
      projectId: category.projectId,
      summary: `카테고리 '${category.name}' 생성`,
    });

    res.json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

app.delete('/api/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;

    const { id } = req.params;

    if (!(await findCategoryInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get category name before deletion for audit log
    const category = await prisma.category.findUnique({ where: { id } });

    await prisma.category.delete({
      where: { id },
    });

    // Audit log
    await (req as any).audit?.({
      action: 'DELETE',
      entityType: 'Category',
      entityId: id,
      entityTitle: category?.name || 'Unknown',
      projectId: category?.projectId,
      summary: `카테고리 '${category?.name || 'Unknown'}' 삭제`,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

app.put('/api/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;

    const { id } = req.params;
    const { color, name } = req.body;

    if (!(await findCategoryInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updateData: any = {};
    if (color !== undefined) updateData.color = color;
    if (name !== undefined) updateData.name = name;

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await (req as any).audit?.({
      action: 'UPDATE',
      entityType: 'Category',
      entityId: category.id,
      entityTitle: category.name,
      projectId: category.projectId,
      summary: `카테고리 '${category.name}' 수정`,
    });

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Goals endpoints
app.get('/api/goals', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const showCompleted = req.query.showCompleted === 'true';
    const showOnHold = req.query.showOnHold !== 'false'; // default true
    const includeDescendants = req.query.includeDescendants === 'true';
    const lightweight = req.query.lightweight === 'true';
    const completedDateFrom = req.query.completedDateFrom as string | undefined; // "YYYY-MM-DD"
    const completedDateTo = req.query.completedDateTo as string | undefined;     // "YYYY-MM-DD"

    let projectIds = [projectId];

    if (includeDescendants) {
      const descendants = await getDescendantIds(projectId);
      projectIds = [projectId, ...descendants];
    }

    const whereClause: any = {
      projectId: { in: projectIds }
    };
    whereClause.project = { organizationId: req.organizationId };

    // "내 목표" 필터: 현재 사용자가 담당자(GoalOwner.userId)로 연결된 목표만
    if (req.query.mine === 'true') {
      whereClause.goalOwners = { some: { userId: req.user!.userId } };
    }
    if (!showCompleted) {
      whereClause.completed = false;
    }
    if (!showOnHold) {
      whereClause.onHold = false;
    }

    // Date range filter for completed goals
    if (showCompleted && (completedDateFrom || completedDateTo)) {
      const { buildCompletedDateFilter } = await import('./goalDateFilter');
      const orClause = buildCompletedDateFilter(completedDateFrom, completedDateTo);
      if (orClause) whereClause.OR = orClause;
    }

    let transformedGoals: any[];

    if (lightweight) {
      const goals = await prisma.goal.findMany({
        where: whereClause,
        select: {
          id: true, title: true, owner: true, description: true,
          progress: true, size: true,
          startDate: true, dueDate: true, statusNote: true,
          order: true, completed: true, onHold: true, version: true,
          parentGoalId: true, cycleId: true,
          statusId: true, customFields: true,
          projectId: true,
          project: { select: { id: true, name: true } },
          categories: { select: { name: true } },
          goalOwners: { select: { ownerName: true }, orderBy: { order: 'asc' } },
          subGoals: {
            orderBy: { order: 'asc' },
            select: {
              id: true, title: true, owner: true, description: true,
              progress: true, targetValue: true, currentValue: true, startValue: true, unit: true,
              startDate: true, dueDate: true, statusNote: true,
              order: true,
              subGoalOwners: { select: { ownerName: true }, orderBy: { order: 'asc' } },
            },
          },
        },
        orderBy: { order: 'asc' },
      });

      transformedGoals = goals.map((goal) => ({
        ...goal,
        owner: goal.goalOwners.length > 0 ? goal.goalOwners[0].ownerName : goal.owner,
        owners: goal.goalOwners.length > 0 ? goal.goalOwners.map(o => o.ownerName) : (goal.owner ? [goal.owner] : []),
        categories: goal.categories.map(cat => cat.name),
        subGoals: goal.subGoals.map(sg => ({
          ...sg,
          owner: sg.subGoalOwners.length > 0 ? sg.subGoalOwners[0].ownerName : sg.owner,
          owners: sg.subGoalOwners.length > 0 ? sg.subGoalOwners.map(o => o.ownerName) : (sg.owner ? [sg.owner] : []),
        })),
        notes: [],
        attachments: [],
      }));
    } else {
      const goals = await prisma.goal.findMany({
        where: whereClause,
        include: {
          categories: true,
          subGoals: {
            orderBy: { order: 'asc' },
            include: { subGoalOwners: { orderBy: { order: 'asc' } } },
          },
          goalOwners: { orderBy: { order: 'asc' } },
          project: { select: { id: true, name: true } },
          notes: { orderBy: { createdAt: 'desc' } },
          attachments: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { order: 'asc' },
      });

      transformedGoals = goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        description: goal.description,
        owner: goal.goalOwners.length > 0 ? goal.goalOwners[0].ownerName : goal.owner,
        owners: goal.goalOwners.length > 0 ? goal.goalOwners.map(o => o.ownerName) : (goal.owner ? [goal.owner] : []),
        projectId: goal.projectId,
        project: goal.project,
        categories: goal.categories.map(cat => cat.name),
        progress: goal.progress,
        size: goal.size,
        startDate: goal.startDate,
        dueDate: goal.dueDate,
        statusNote: goal.statusNote,
        order: goal.order,
        completed: goal.completed,
        onHold: goal.onHold,
        version: goal.version,
        parentGoalId: goal.parentGoalId,
        cycleId: goal.cycleId,
        statusId: goal.statusId,
        customFields: goal.customFields,
        subGoals: goal.subGoals.map(sg => ({
          ...sg,
          owner: sg.subGoalOwners.length > 0 ? sg.subGoalOwners[0].ownerName : sg.owner,
          owners: sg.subGoalOwners.length > 0 ? sg.subGoalOwners.map(o => o.ownerName) : (sg.owner ? [sg.owner] : []),
        })),
        notes: goal.notes,
        attachments: goal.attachments,
      }));
    }

    res.json(transformedGoals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// Get single goal with latest data
app.get('/api/goals/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const goal = await prisma.goal.findFirst({
      where: { id, project: { organizationId: req.organizationId } },
      include: {
        categories: true,
        subGoals: {
          orderBy: { order: 'asc' },
          include: { subGoalOwners: { orderBy: { order: 'asc' } } },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        goalOwners: { orderBy: { order: 'asc' } },
      },
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Transform to match frontend format
    const transformedGoal = {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      owner: goal.goalOwners.length > 0 ? goal.goalOwners[0].ownerName : goal.owner,
      owners: goal.goalOwners.length > 0 ? goal.goalOwners.map(o => o.ownerName) : (goal.owner ? [goal.owner] : []),
      categories: goal.categories.map(cat => cat.name),
      progress: goal.progress,
      size: goal.size,
      startDate: goal.startDate,
      dueDate: goal.dueDate,
      statusNote: goal.statusNote,
      order: goal.order,
      completed: goal.completed,
      onHold: goal.onHold,
      version: goal.version,
      parentGoalId: goal.parentGoalId,
      cycleId: goal.cycleId,
      statusId: goal.statusId,
      customFields: goal.customFields,
      subGoals: goal.subGoals.map(sg => ({
        ...sg,
        owner: sg.subGoalOwners.length > 0 ? sg.subGoalOwners[0].ownerName : sg.owner,
        owners: sg.subGoalOwners.length > 0 ? sg.subGoalOwners.map(o => o.ownerName) : (sg.owner ? [sg.owner] : []),
      })),
      notes: goal.notes,
      attachments: goal.attachments,
    };

    res.json(transformedGoal);
  } catch (error) {
    console.error('Error fetching goal:', error);
    res.status(500).json({ error: 'Failed to fetch goal' });
  }
});

app.post('/api/goals', async (req: AuthRequest, res: Response) => {
  try {
    // statusId/customFields/completed/onHold/status/version 은 신뢰불가 → ...goalData 스프레드에서 분리.
    // 이들은 아래에서 statusSync/validateAndMergeFieldValues 경유로만 반영한다(진짜 스프레드 함정).
    const {
      categories, subGoals, notes, attachments, projectId, owners,
      statusId: requestedStatusId, customFields: requestedCustomFields,
      completed: _completedIn, onHold: _onHoldIn, status: _statusIn, version: _versionIn,
      ...goalData
    } = req.body;

    // owners 배열이 있으면 첫 번째를 owner 필드에 동기화
    if (owners && Array.isArray(owners) && owners.length > 0) {
      goalData.owner = owners[0];
    }

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    if (!(await findProjectInOrg(projectId, req.organizationId!))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 사이클/정렬(parent) 검증 (제공된 경우만). parentGoalId/cycleId는 goalData에 포함되어
    // goal.create의 ...goalData 스프레드로 저장된다. 새 목표라 순환은 불가하므로 자기참조·존재검증만.
    if (goalData.cycleId !== undefined && goalData.cycleId !== null) {
      if (!(await findCycleInOrg(goalData.cycleId, req.organizationId!))) {
        return res.status(400).json({ error: 'Cycle not found' });
      }
    }
    if (goalData.parentGoalId !== undefined && goalData.parentGoalId !== null) {
      if (goalData.id && goalData.parentGoalId === goalData.id) {
        return res.status(400).json({ error: 'Cannot align goal to itself' });
      }
      if (!(await findGoalInOrg(goalData.parentGoalId, req.organizationId!))) {
        return res.status(400).json({ error: 'Parent goal not found' });
      }
    }

    // 담당자 이름 → 조직 멤버 userId 매핑 (GoalOwner/SubGoalOwner에 링크 주입)
    const ownerMap = await buildOwnerNameToUserId(req.organizationId!);

    // Validate categories (1-5 required)
    if (!categories || !Array.isArray(categories) || categories.length < 1 || categories.length > 5) {
      return res.status(400).json({ error: 'Must provide 1-5 categories' });
    }

    // Find or create categories (within the project)
    const categoryRecords = await Promise.all(
      categories.map(async (categoryName: string) => {
        let categoryRecord = await prisma.category.findFirst({
          where: {
            name: categoryName,
            projectId: projectId,
          },
        });

        if (!categoryRecord) {
          categoryRecord = await prisma.category.create({
            data: { name: categoryName, color: '#6b7280', projectId },
          });
        }

        return categoryRecord;
      })
    );

    // 초기 상태 해석: statusId(요청·검증) 또는 completed/progress 기반 앵커. completed/onHold 는 라벨 kind 미러.
    const progress = goalData.progress !== undefined ? goalData.progress : 0;
    const initial = await resolveInitialStatus(req.organizationId!, {
      requestedStatusId,
      completed: typeof _completedIn === 'boolean' ? _completedIn : undefined,
      onHold: typeof _onHoldIn === 'boolean' ? _onHoldIn : undefined,
      progress,
    });

    // 커스텀 필드 검증·병합 (프로젝트 정의 기준, person userId 조직멤버 검증)
    let customFields: Record<string, unknown> = {};
    if (requestedCustomFields && typeof requestedCustomFields === 'object') {
      const defs = await prisma.customFieldDefinition.findMany({ where: { projectId } });
      const memberIds = await getOrgMemberIds(req.organizationId!);
      try {
        customFields = validateAndMergeFieldValues(defs, {}, requestedCustomFields as Record<string, unknown>, memberIds);
      } catch (e: any) {
        return res.status(400).json({ error: e?.message || '커스텀 필드 값이 유효하지 않습니다.' });
      }
    }

    const goal = await prisma.goal.create({
      data: {
        ...goalData,
        projectId,
        completed: initial.completed,
        onHold: initial.onHold,
        statusId: initial.statusId,
        customFields: customFields as any,
        categories: {
          connect: categoryRecords.map(cat => ({ id: cat.id })),
        },
        subGoals: subGoals
          ? {
              create: subGoals.map((sg: any, index: number) => ({
                id: sg.id,
                title: sg.title,
                description: sg.description,
                owner: sg.owners ? sg.owners[0] || sg.owner || '' : sg.owner || '',
                progress: computeSubGoalProgress(sg),
                targetValue: sg.targetValue ?? null,
                currentValue: sg.currentValue ?? null,
                startValue: sg.startValue ?? null,
                unit: sg.unit ?? null,
                startDate: sg.startDate,
                dueDate: sg.dueDate,
                statusNote: sg.statusNote,
                order: index,
              })),
            }
          : undefined,
        notes: notes
          ? {
              create: notes.map((note: any) => ({
                id: note.id,
                content: note.content,
                isPinned: note.isPinned,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
              })),
            }
          : undefined,
        goalOwners: owners && Array.isArray(owners) && owners.length > 0
          ? { create: owners.map((name: string, i: number) => ({ ownerName: name, userId: ownerMap.get(name) ?? null, order: i })) }
          : goalData.owner
            ? { create: [{ ownerName: goalData.owner, userId: ownerMap.get(goalData.owner) ?? null, order: 0 }] }
            : undefined,
      },
      include: {
        categories: true,
        subGoals: {
          orderBy: { order: 'asc' },
          include: { subGoalOwners: { orderBy: { order: 'asc' } } },
        },
        notes: true,
        goalOwners: { orderBy: { order: 'asc' } },
      },
    });

    // SubGoal에 대해 SubGoalOwner 레코드 생성
    if (subGoals && goal.subGoals.length > 0) {
      for (let i = 0; i < subGoals.length; i++) {
        const sg = subGoals[i];
        const createdSg = goal.subGoals[i];
        if (!createdSg) continue;
        const sgOwners: string[] = sg.owners && Array.isArray(sg.owners) && sg.owners.length > 0
          ? sg.owners
          : sg.owner ? [sg.owner] : [];
        if (sgOwners.length > 0) {
          await prisma.subGoalOwner.createMany({
            data: sgOwners.map((name: string, idx: number) => ({
              subGoalId: createdSg.id,
              ownerName: name,
              userId: ownerMap.get(name) ?? null,
              order: idx,
            })),
          });
        }
      }
    }

    // Audit log
    await (req as any).audit?.({
      action: 'CREATE',
      entityType: 'Goal',
      entityId: goal.id,
      entityTitle: goal.title,
      goalId: goal.id,
      projectId: projectId,
      summary: `목표 '${goal.title}' 생성`,
    });

    // 담당자 배정 알림 (배정된 조직 멤버에게, 본인 제외)
    await createAssignmentNotifications({
      organizationId: req.organizationId!,
      goalId: goal.id,
      goalTitle: goal.title,
      assigneeUserIds: goal.goalOwners.map((o: any) => o.userId),
      actorUserId: req.user!.userId,
      actorName: req.user!.name,
    });

    // 자동화 이벤트: 목표 생성
    emitDomainEvent({
      type: 'goal_created', organizationId: req.organizationId!, projectId,
      goalId: goal.id, actor: { userId: req.user!.userId, name: req.user!.name }, changes: {},
    });

    res.json({
      ...goal,
      owner: goal.goalOwners.length > 0 ? goal.goalOwners[0].ownerName : goal.owner,
      owners: goal.goalOwners.map(o => o.ownerName),
      categories: goal.categories.map(cat => cat.name),
      subGoals: goal.subGoals.map(sg => ({
        ...sg,
        owner: sg.subGoalOwners.length > 0 ? sg.subGoalOwners[0].ownerName : sg.owner,
        owners: sg.subGoalOwners.length > 0 ? sg.subGoalOwners.map(o => o.ownerName) : (sg.owner ? [sg.owner] : []),
      })),
    });
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// Bulk update goal orders (for drag and drop)
// IMPORTANT: This must be before /api/goals/:id to avoid route matching issues
app.put('/api/goals/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const { goals } = req.body;

    if (!goals || !Array.isArray(goals)) {
      return res.status(400).json({ error: 'Invalid request: goals must be an array' });
    }

    const goalIds = goals.map((goal: { id: string; order: number }) => goal.id);
    const scopedCount = await prisma.goal.count({
      where: { id: { in: goalIds }, project: { organizationId: req.organizationId } },
    });
    if (scopedCount !== goalIds.length) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    await Promise.all(
      goals.map((goal: { id: string; order: number }) =>
        prisma.goal.update({
          where: { id: goal.id },
          data: { order: goal.order },
        })
      )
    );

    // Audit log
    await (req as any).audit?.({
      action: 'REORDER',
      entityType: 'Goal',
      entityId: 'bulk',
      entityTitle: `${goals.length} goals reordered`,
      summary: `${goals.length}개 목표 순서 변경`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering goals:', error);
    res.status(500).json({ error: 'Failed to reorder goals' });
  }
});

// Toggle goal completion status
app.put('/api/goals/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { completed } = req.body;

    const beforeGoal = await findGoalInOrg(id, req.organizationId!);
    if (!beforeGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const updateData: any = {
      completed,
      version: { increment: 1 },
    };
    // 완료 설정 시 보류 해제 (상호 배타)
    if (completed) {
      updateData.onHold = false;
    }

    await prisma.goal.update({
      where: { id },
      data: updateData,
    });

    // 상태 라벨 동기화: 플래그 변경 → statusId (완료→완료 라벨, 해제→진행 중/시작 전)
    await syncStatusFromFlags(id, { completed, onHold: completed ? false : undefined }, req.organizationId!);

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        categories: true,
        subGoals: { orderBy: { order: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    // Audit log
    await (req as any).audit?.({
      action: 'UPDATE',
      entityType: 'Goal',
      entityId: goal.id,
      entityTitle: goal.title,
      goalId: goal.id,
      projectId: goal.projectId,
      summary: completed ? `목표 '${goal.title}' 완료 처리` : `목표 '${goal.title}' 완료 해제`,
      changes: { completed },
    });

    // 자동화 이벤트: 상태 변경(완료/해제 → statusId 미러됨)
    if (beforeGoal.statusId !== goal.statusId) {
      emitDomainEvent({
        type: 'status_changed', organizationId: req.organizationId!, projectId: goal.projectId,
        goalId: id, actor: { userId: req.user!.userId, name: req.user!.name },
        changes: { statusId: { from: beforeGoal.statusId, to: goal.statusId } },
      });
    }

    res.json({
      ...goal,
      categories: goal.categories.map(cat => cat.name),
    });
  } catch (error) {
    console.error('Error toggling goal completion:', error);
    res.status(500).json({ error: 'Failed to toggle goal completion' });
  }
});

// Toggle goal on-hold status
app.put('/api/goals/:id/hold', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { onHold } = req.body;

    const beforeGoal = await findGoalInOrg(id, req.organizationId!);
    if (!beforeGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const updateData: any = {
      onHold,
      version: { increment: 1 },
    };
    // 보류 설정 시 완료 해제 (상호 배타)
    if (onHold) {
      updateData.completed = false;
    }

    await prisma.goal.update({
      where: { id },
      data: updateData,
    });

    // 상태 라벨 동기화: 플래그 변경 → statusId (보류→보류 라벨, 해제→진행 중/시작 전)
    await syncStatusFromFlags(id, { onHold, completed: onHold ? false : undefined }, req.organizationId!);

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        categories: true,
        subGoals: { orderBy: { order: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    // Audit log
    await (req as any).audit?.({
      action: 'UPDATE',
      entityType: 'Goal',
      entityId: goal.id,
      entityTitle: goal.title,
      goalId: goal.id,
      projectId: goal.projectId,
      summary: onHold ? `목표 '${goal.title}' 보류 처리` : `목표 '${goal.title}' 보류 해제`,
      changes: { onHold },
    });

    // 자동화 이벤트: 상태 변경(보류/해제 → statusId 미러됨)
    if (beforeGoal.statusId !== goal.statusId) {
      emitDomainEvent({
        type: 'status_changed', organizationId: req.organizationId!, projectId: goal.projectId,
        goalId: id, actor: { userId: req.user!.userId, name: req.user!.name },
        changes: { statusId: { from: beforeGoal.statusId, to: goal.statusId } },
      });
    }

    res.json({
      ...goal,
      categories: goal.categories.map(cat => cat.name),
    });
  } catch (error) {
    console.error('Error toggling goal on-hold:', error);
    res.status(500).json({ error: 'Failed to toggle goal on-hold' });
  }
});

app.put('/api/goals/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { categories, subGoals, notes, attachments, version, owners, ...goalData } = req.body;

    if (!(await findGoalInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // owners 배열이 있으면 첫 번째를 owner 필드에 동기화
    if (owners && Array.isArray(owners) && owners.length > 0) {
      goalData.owner = owners[0];
    }

    // Validate categories (1-5 required)
    if (!categories || !Array.isArray(categories) || categories.length < 1 || categories.length > 5) {
      return res.status(400).json({ error: 'Must provide 1-5 categories' });
    }

    // 담당자 이름 → 조직 멤버 userId 매핑 (GoalOwner/SubGoalOwner에 링크 주입)
    const ownerMap = await buildOwnerNameToUserId(req.organizationId!);

    // Pre-fetch current goal for version check, projectId and change tracking
    const currentGoal = await prisma.goal.findUnique({
      where: { id },
      include: {
        categories: true,
        subGoals: { orderBy: { order: 'asc' } },
        notes: true,
        goalOwners: { select: { userId: true } },
      },
    });

    if (!currentGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (version !== undefined && currentGoal.version !== version) {
      return res.status(409).json({
        error: 'Conflict',
        message: '다른 사용자가 이 목표를 수정했습니다. 새로고침 후 다시 시도하세요.',
        currentData: currentGoal,
      });
    }

    // 사이클/정렬(parent) 검증 (제공된 경우만)
    if (goalData.cycleId !== undefined && goalData.cycleId !== null) {
      if (!(await findCycleInOrg(goalData.cycleId, req.organizationId!))) {
        return res.status(400).json({ error: 'Cycle not found' });
      }
    }
    if (goalData.parentGoalId !== undefined && goalData.parentGoalId !== null) {
      if (goalData.parentGoalId === id) {
        return res.status(400).json({ error: 'Cannot align goal to itself' });
      }
      if (!(await findGoalInOrg(goalData.parentGoalId, req.organizationId!))) {
        return res.status(400).json({ error: 'Parent goal not found' });
      }
      // 순환 방지: parent 체인을 따라 올라가며 현재 목표(id)에 도달하면 순환
      let cursor: string | null = goalData.parentGoalId;
      while (cursor) {
        if (cursor === id) {
          return res.status(400).json({ error: 'Circular alignment not allowed' });
        }
        const ancestor: { parentGoalId: string | null } | null = await prisma.goal.findUnique({
          where: { id: cursor },
          select: { parentGoalId: true },
        });
        cursor = ancestor?.parentGoalId ?? null;
      }
    }

    // Find or create categories (outside transaction)
    const categoryRecords = await Promise.all(
      categories.map(async (categoryName: string) => {
        let categoryRecord = await prisma.category.findFirst({
          where: {
            name: categoryName,
            projectId: currentGoal.projectId
          },
        });

        if (!categoryRecord) {
          categoryRecord = await prisma.category.create({
            data: {
              name: categoryName,
              color: '#6b7280',
              projectId: currentGoal.projectId
            },
          });
        }

        return categoryRecord;
      })
    );

    // Use transaction to ensure atomicity of all updates
    const goal = await prisma.$transaction(async (tx) => {
      // Double-check version inside transaction to prevent race conditions
      const goalInTransaction = await tx.goal.findUnique({
        where: { id },
        select: { version: true },
      });

      if (!goalInTransaction || (version !== undefined && goalInTransaction.version !== version)) {
        throw new Error('VERSION_CONFLICT');
      }

      // Partial update for SubGoals
      if (subGoals) {
        const incomingSubGoalIds = new Set(subGoals.map((sg: any) => sg.id).filter(Boolean));
        const existingSubGoalIds = new Set(currentGoal.subGoals.map((sg) => sg.id));

        // Delete subgoals that are not in the incoming data
        const subGoalsToDelete = currentGoal.subGoals.filter((sg) => !incomingSubGoalIds.has(sg.id));
        for (const sg of subGoalsToDelete) {
          await tx.subGoal.delete({ where: { id: sg.id } });
        }

        // Update existing or create new subgoals
        for (let i = 0; i < subGoals.length; i++) {
          const sg = subGoals[i];
          const sgOwners: string[] = sg.owners && Array.isArray(sg.owners) && sg.owners.length > 0
            ? sg.owners
            : sg.owner ? [sg.owner] : [];
          const sgOwnerFirst = sgOwners[0] || sg.owner || '';

          if (sg.id && existingSubGoalIds.has(sg.id)) {
            // Update existing subgoal
            await tx.subGoal.update({
              where: { id: sg.id },
              data: {
                title: sg.title,
                description: sg.description,
                owner: sgOwnerFirst,
                progress: computeSubGoalProgress(sg),
                targetValue: sg.targetValue ?? null,
                currentValue: sg.currentValue ?? null,
                startValue: sg.startValue ?? null,
                unit: sg.unit ?? null,
                startDate: sg.startDate,
                dueDate: sg.dueDate,
                statusNote: sg.statusNote,
                order: i,
                version: { increment: 1 },
              },
            });
            // SubGoalOwner 교체: 기존 삭제 후 재생성
            await tx.subGoalOwner.deleteMany({ where: { subGoalId: sg.id } });
            if (sgOwners.length > 0) {
              await tx.subGoalOwner.createMany({
                data: sgOwners.map((name: string, idx: number) => ({
                  subGoalId: sg.id,
                  ownerName: name,
                  userId: ownerMap.get(name) ?? null,
                  order: idx,
                })),
              });
            }
          } else {
            // Create new subgoal
            const newSg = await tx.subGoal.create({
              data: {
                id: sg.id || undefined,
                title: sg.title,
                description: sg.description,
                owner: sgOwnerFirst,
                progress: computeSubGoalProgress(sg),
                targetValue: sg.targetValue ?? null,
                currentValue: sg.currentValue ?? null,
                startValue: sg.startValue ?? null,
                unit: sg.unit ?? null,
                startDate: sg.startDate,
                dueDate: sg.dueDate,
                statusNote: sg.statusNote,
                order: i,
                goalId: id,
              },
            });
            if (sgOwners.length > 0) {
              await tx.subGoalOwner.createMany({
                data: sgOwners.map((name: string, idx: number) => ({
                  subGoalId: newSg.id,
                  ownerName: name,
                  userId: ownerMap.get(name) ?? null,
                  order: idx,
                })),
              });
            }
          }
        }
      }

      // Partial update for Notes
      if (notes) {
        const incomingNoteIds = new Set(notes.map((note: any) => note.id).filter(Boolean));
        const existingNotesMap = new Map(currentGoal.notes.map((note) => [note.id, note]));

        // Delete notes that are not in the incoming data
        const notesToDelete = currentGoal.notes.filter((note) => !incomingNoteIds.has(note.id));
        for (const note of notesToDelete) {
          await tx.note.delete({ where: { id: note.id } });
        }

        // Update existing or create new notes
        for (const note of notes) {
          const existingNote = note.id ? existingNotesMap.get(note.id) : null;

          if (existingNote) {
            const { shouldUpdate, data } = buildNoteUpdateData(existingNote, note);
            if (shouldUpdate) {
              await tx.note.update({
                where: { id: note.id },
                data,
              });
            }
          } else {
            // Create new note
            await tx.note.create({
              data: {
                id: note.id || undefined,
                content: note.content,
                isPinned: note.isPinned,
                goalId: id,
                createdAt: note.createdAt || new Date(),
              },
            });
          }
        }
      }

      // 진행률이 100에 (상향) 도달하면 완료로 자동 승격 — statusId.kind 가 done/on_hold 의 진실이므로
      // 승격은 완료 라벨 + 미러 플래그를 함께 세팅. progress<100 은 절대 완료/보류를 강등하지 않는다
      // (사용자가 칸반/버튼으로 지정한 상태 보존). 이것이 적대적 검증 critical 수정의 핵심.
      const newProgress = goalData.progress !== undefined ? goalData.progress : currentGoal.progress;

      // Only pick allowed fields for update (exclude projectId, project, id, etc.)
      const updateFields: any = {};
      if (newProgress >= 100 && !currentGoal.completed) {
        const promoted = await resolveInitialStatus(req.organizationId!, { completed: true }, tx);
        updateFields.completed = true;
        updateFields.onHold = false;
        updateFields.statusId = promoted.statusId;
      }
      if (goalData.title !== undefined) updateFields.title = goalData.title;
      if (goalData.description !== undefined) updateFields.description = goalData.description;
      if (goalData.owner !== undefined) updateFields.owner = goalData.owner;
      if (goalData.progress !== undefined) updateFields.progress = goalData.progress;
      if (goalData.size !== undefined) updateFields.size = goalData.size;
      if (goalData.startDate !== undefined) updateFields.startDate = goalData.startDate;
      if (goalData.dueDate !== undefined) updateFields.dueDate = goalData.dueDate;
      if (goalData.statusNote !== undefined) updateFields.statusNote = goalData.statusNote;
      if (goalData.order !== undefined) updateFields.order = goalData.order;
      if (goalData.parentGoalId !== undefined) updateFields.parentGoalId = goalData.parentGoalId;
      if (goalData.cycleId !== undefined) updateFields.cycleId = goalData.cycleId;

      // GoalOwner 교체
      if (owners && Array.isArray(owners)) {
        await tx.goalOwner.deleteMany({ where: { goalId: id } });
        if (owners.length > 0) {
          await tx.goalOwner.createMany({
            data: owners.map((name: string, idx: number) => ({
              goalId: id,
              ownerName: name,
              userId: ownerMap.get(name) ?? null,
              order: idx,
            })),
          });
        }
      }

      // Update the goal with incremented version
      return await tx.goal.update({
        where: { id },
        data: {
          ...updateFields,
          categories: {
            set: categoryRecords.map(cat => ({ id: cat.id })),
          },
          version: { increment: 1 },
        },
        include: {
          categories: true,
          subGoals: {
            orderBy: { order: 'asc' },
            include: { subGoalOwners: { orderBy: { order: 'asc' } } },
          },
          notes: {
            orderBy: { createdAt: 'desc' },
          },
          goalOwners: { orderBy: { order: 'asc' } },
        },
      });
    });

    // Build changes data for audit log
    const oldCategoryNames = currentGoal.categories.map(c => c.name);
    const changesData = buildChangesData(
      currentGoal,
      goalData,
      oldCategoryNames,
      categories,
      currentGoal.subGoals.map(sg => ({
        id: sg.id,
        title: sg.title,
        progress: sg.progress,
        owner: sg.owner,
      })),
      subGoals,
      currentGoal.notes.map(n => ({ id: n.id, content: n.content })),
      notes
    );

    // Audit log (outside transaction)
    await (req as any).audit?.({
      action: 'UPDATE',
      entityType: 'Goal',
      entityId: goal.id,
      entityTitle: goal.title,
      goalId: goal.id,
      projectId: currentGoal.projectId,
      summary: `목표 '${goal.title}' 수정`,
      changes: changesData,
    });

    // 새로 배정된 담당자에게만 알림 (기존 담당자·본인 제외)
    if (owners && Array.isArray(owners)) {
      const oldOwnerIds = new Set(
        (currentGoal.goalOwners as { userId: string | null }[]).map(o => o.userId).filter(Boolean)
      );
      const newlyAssigned = (goal.goalOwners as { userId: string | null }[])
        .map(o => o.userId)
        .filter((uid) => uid && !oldOwnerIds.has(uid));
      await createAssignmentNotifications({
        organizationId: req.organizationId!,
        goalId: goal.id,
        goalTitle: goal.title,
        assigneeUserIds: newlyAssigned,
        actorUserId: req.user!.userId,
        actorName: req.user!.name,
      });
    }

    // 진행률이 실제로 변경되면 체크인(진행률 스냅샷) 자동 기록
    if (goalData.progress !== undefined && currentGoal.progress !== goalData.progress) {
      await prisma.checkIn.create({
        data: {
          goalId: id,
          userId: req.user!.userId,
          progress: goalData.progress,
          note: goalData.statusNote ?? null,
        },
      });
    }

    // 자동화 이벤트: 진행률 도달 / 담당자 지정
    const actor = { userId: req.user!.userId, name: req.user!.name };
    if (goalData.progress !== undefined && goalData.progress !== currentGoal.progress) {
      emitDomainEvent({
        type: 'progress_reached', organizationId: req.organizationId!, projectId: currentGoal.projectId,
        goalId: id, actor, changes: { progress: { from: currentGoal.progress, to: goalData.progress } },
      });
    }
    if (owners && Array.isArray(owners)) {
      const oldIds = new Set((currentGoal.goalOwners as { userId: string | null }[]).map(o => o.userId).filter(Boolean));
      const added = (goal.goalOwners as { userId: string | null }[]).map(o => o.userId).filter((u): u is string => !!u && !oldIds.has(u));
      if (added.length > 0) {
        emitDomainEvent({
          type: 'assignee_changed', organizationId: req.organizationId!, projectId: currentGoal.projectId,
          goalId: id, actor, changes: { assigneesAdded: added },
        });
      }
    }

    res.json({
      ...goal,
      owner: goal.goalOwners.length > 0 ? goal.goalOwners[0].ownerName : goal.owner,
      owners: goal.goalOwners.length > 0 ? goal.goalOwners.map(o => o.ownerName) : (goal.owner ? [goal.owner] : []),
      categories: goal.categories.map(cat => cat.name),
      subGoals: goal.subGoals.map(sg => ({
        ...sg,
        owner: sg.subGoalOwners.length > 0 ? sg.subGoalOwners[0].ownerName : sg.owner,
        owners: sg.subGoalOwners.length > 0 ? sg.subGoalOwners.map(o => o.ownerName) : (sg.owner ? [sg.owner] : []),
      })),
    });
  } catch (error: any) {
    console.error('Error updating goal:', error);

    // Handle version conflict from transaction
    if (error.message === 'VERSION_CONFLICT') {
      return res.status(409).json({
        error: 'Conflict',
        message: '다른 사용자가 이 목표를 수정했습니다. 새로고침 후 다시 시도하세요.',
      });
    }

    res.status(500).json({ error: 'Failed to update goal' });
  }
});

app.delete('/api/goals/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;

    const { id } = req.params;

    if (!(await findGoalInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Get goal title and projectId before deletion for audit log
    const goal = await prisma.goal.findUnique({ where: { id } });

    await prisma.goal.delete({
      where: { id },
    });

    // Audit log
    await (req as any).audit?.({
      action: 'DELETE',
      entityType: 'Goal',
      entityId: id,
      entityTitle: goal?.title || 'Unknown',
      goalId: id,
      projectId: goal?.projectId,
      summary: `목표 '${goal?.title || 'Unknown'}' 삭제`,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// Activity Log endpoints

// Get activity feed (all activities)
app.get('/api/activity', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, limit = '50', offset = '0' } = req.query;

    const where: any = { organizationId: req.organizationId };
    if (projectId) where.projectId = projectId as string;

    const activities = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, picture: true } } },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    // IP 주소 또는 사용자 이름 표시
    const result = activities.map(a => ({
      ...a,
      displayName: a.user?.name || a.ipAddress || '알 수 없음',
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

// Get activity for a specific goal
app.get('/api/goals/:id/activity', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    if (!(await findGoalInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const activities = await prisma.auditLog.findMany({
      where: { goalId: id, organizationId: req.organizationId },
      include: { user: { select: { name: true, picture: true } } },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    // IP 주소 또는 사용자 이름 표시
    const result = activities.map(a => ({
      ...a,
      displayName: a.user?.name || a.ipAddress || '알 수 없음',
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching goal activity:', error);
    res.status(500).json({ error: 'Failed to fetch goal activity' });
  }
});

// 목표 체크인(진행률 스냅샷) 이력 조회 (최근 50건)
app.get('/api/goals/:id/check-ins', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!(await findGoalInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const checkIns = await prisma.checkIn.findMany({
      where: { goalId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true } } },
    });

    res.json(checkIns);
  } catch (error) {
    console.error('Error fetching goal check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch goal check-ins' });
  }
});

// Serve static files from dist directory in production
if (process.env.NODE_ENV === 'production' || Number(PORT) === 80) {
  const distPath = path.resolve(process.cwd(), 'dist');
  console.log('Serving static files from:', distPath);
  app.use(express.static(distPath));

  // Handle client-side routing - send all non-API requests to index.html
  app.use((req: Request, res: Response, next) => {
    // Skip if it's an API request
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Copy goal to another project
app.post('/api/goals/:id/copy', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { targetProjectId } = req.body;

    if (!targetProjectId) {
      return res.status(400).json({ error: 'targetProjectId is required' });
    }

    if (!(await findGoalInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Get source goal with all related data
    const sourceGoal = await prisma.goal.findUnique({
      where: { id },
      include: {
        categories: true,
        subGoals: {
          orderBy: { order: 'asc' },
          include: { subGoalOwners: { orderBy: { order: 'asc' } } },
        },
        notes: true,
        goalOwners: { orderBy: { order: 'asc' } },
      },
    });

    if (!sourceGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Prevent copying to same project
    if (sourceGoal.projectId === targetProjectId) {
      return res.status(400).json({ error: 'Cannot copy to the same project' });
    }

    // Verify target project exists (within the same organization)
    const targetProject = await findProjectInOrg(targetProjectId, req.organizationId!);

    if (!targetProject) {
      return res.status(404).json({ error: 'Target project not found' });
    }

    // Get source project for audit log
    const sourceProject = await prisma.project.findUnique({
      where: { id: sourceGoal.projectId },
    });

    // Handle category mapping
    const categoryMapping: Record<string, { targetId: string; isNew: boolean; name: string }> = {};

    for (const sourceCategory of sourceGoal.categories) {
      // Check if category with same name exists in target project
      let targetCategory = await prisma.category.findFirst({
        where: {
          name: sourceCategory.name,
          projectId: targetProjectId,
        },
      });

      if (targetCategory) {
        categoryMapping[sourceCategory.id] = {
          targetId: targetCategory.id,
          isNew: false,
          name: sourceCategory.name,
        };
      } else {
        // Create new category in target project
        targetCategory = await prisma.category.create({
          data: {
            name: sourceCategory.name,
            color: sourceCategory.color,
            projectId: targetProjectId,
          },
        });
        categoryMapping[sourceCategory.id] = {
          targetId: targetCategory.id,
          isNew: true,
          name: sourceCategory.name,
        };
      }
    }

    // Get max order in target project
    const maxOrderGoal = await prisma.goal.findFirst({
      where: { projectId: targetProjectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const newOrder = (maxOrderGoal?.order ?? -1) + 1;

    // Create new goal
    const newGoal = await prisma.goal.create({
      data: {
        title: sourceGoal.title,
        description: sourceGoal.description,
        progress: sourceGoal.progress,
        owner: sourceGoal.owner,
        size: sourceGoal.size,
        startDate: sourceGoal.startDate,
        dueDate: sourceGoal.dueDate,
        statusNote: sourceGoal.statusNote,
        // 상태 브리지: 같은 조직 내 복사이므로(위 findProjectInOrg 검증) statusId 직접 복사 —
        // '위험' 등 active 라벨 보존. completed/onHold 미러도 함께 복사해 정합 유지.
        // customFields 는 프로젝트별 정의(defId)에 종속되므로 대상 프로젝트에선 무의미 → 비움.
        completed: sourceGoal.completed,
        onHold: sourceGoal.onHold,
        statusId: sourceGoal.statusId,
        order: newOrder,
        projectId: targetProjectId,
        categories: {
          connect: Object.values(categoryMapping).map(m => ({ id: m.targetId })),
        },
        subGoals: sourceGoal.subGoals.length > 0 ? {
          create: sourceGoal.subGoals.map((sg, index) => ({
            title: sg.title,
            description: sg.description,
            owner: sg.owner,
            progress: sg.progress,
            startDate: sg.startDate,
            dueDate: sg.dueDate,
            statusNote: sg.statusNote,
            order: index,
          })),
        } : undefined,
        notes: sourceGoal.notes.length > 0 ? {
          create: sourceGoal.notes.map(note => ({
            content: note.content,
            isPinned: note.isPinned,
          })),
        } : undefined,
        goalOwners: sourceGoal.goalOwners.length > 0 ? {
          create: sourceGoal.goalOwners.map(o => ({
            ownerName: o.ownerName,
            order: o.order,
          })),
        } : undefined,
      },
      include: {
        categories: true,
        subGoals: {
          orderBy: { order: 'asc' },
          include: { subGoalOwners: { orderBy: { order: 'asc' } } },
        },
        notes: true,
        goalOwners: { orderBy: { order: 'asc' } },
      },
    });

    // SubGoalOwner 복사
    if (sourceGoal.subGoals.length > 0 && newGoal.subGoals.length > 0) {
      for (let i = 0; i < sourceGoal.subGoals.length; i++) {
        const sourceSg = sourceGoal.subGoals[i];
        const newSg = newGoal.subGoals[i];
        if (!newSg || !sourceSg.subGoalOwners || sourceSg.subGoalOwners.length === 0) continue;
        await prisma.subGoalOwner.createMany({
          data: sourceSg.subGoalOwners.map(o => ({
            subGoalId: newSg.id,
            ownerName: o.ownerName,
            order: o.order,
          })),
        });
      }
    }

    // Audit log
    await (req as any).audit?.({
      action: 'CREATE',
      entityType: 'Goal',
      entityId: newGoal.id,
      entityTitle: newGoal.title,
      goalId: newGoal.id,
      projectId: targetProjectId,
      summary: `목표 '${newGoal.title}' 복사됨 (원본: ${sourceProject?.name || '알 수 없음'})`,
    });

    // 자동화 이벤트: 복사로 생성된 목표(대상 프로젝트)
    emitDomainEvent({
      type: 'goal_created', organizationId: req.organizationId!, projectId: targetProjectId,
      goalId: newGoal.id, actor: { userId: req.user!.userId, name: req.user!.name }, changes: {},
    });

    res.json({
      goal: {
        ...newGoal,
        owner: newGoal.goalOwners.length > 0 ? newGoal.goalOwners[0].ownerName : newGoal.owner,
        owners: newGoal.goalOwners.map(o => o.ownerName),
        categories: newGoal.categories.map(cat => cat.name),
        subGoals: newGoal.subGoals.map(sg => ({
          ...sg,
          owner: sg.subGoalOwners.length > 0 ? sg.subGoalOwners[0].ownerName : sg.owner,
          owners: sg.subGoalOwners.length > 0 ? sg.subGoalOwners.map(o => o.ownerName) : (sg.owner ? [sg.owner] : []),
        })),
      },
      categoryMapping,
      sourceProject: sourceProject?.name,
      targetProject: targetProject.name,
    });
  } catch (error) {
    console.error('Error copying goal:', error);
    res.status(500).json({ error: 'Failed to copy goal' });
  }
});

// Attachment endpoints

// Upload file to a goal
app.post('/api/goals/:id/attachments', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if goal exists (within the same organization)
    const goal = await findGoalInOrg(id, req.organizationId!);
    if (!goal) {
      // Clean up uploaded file (local only; S3 not yet uploaded)
      try { await storageAdapter.delete(file.filename); } catch {}
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Upload via storage adapter (local: no-op, S3: puts to bucket)
    const fileName = await storageAdapter.upload(file);
    const decodedOriginalName = decodeMultipartFilename(file.originalname);

    const attachment = await prisma.attachment.create({
      data: {
        fileName,
        originalName: decodedOriginalName,
        mimeType: file.mimetype,
        size: file.size,
        goalId: id,
      },
    });

    // Audit log
    await (req as any).audit?.({
      action: 'CREATE',
      entityType: 'Attachment',
      entityId: attachment.id,
      entityTitle: decodedOriginalName,
      goalId: id,
      projectId: goal.projectId,
      summary: `'${goal.title}'에 첨부파일 '${decodedOriginalName}' 추가`,
    });

    res.json(attachment);
  } catch (error) {
    console.error('Error uploading file:', error);
    // Clean up file if database operation failed
    if (req.file) {
      try { await storageAdapter.delete(req.file.filename); } catch {}
    }
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get attachments for a goal
app.get('/api/goals/:id/attachments', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!(await findGoalInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const attachments = await prisma.attachment.findMany({
      where: { goalId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(attachments);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Download an attachment
app.get('/api/attachments/:id/download', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const attachment = await findAttachmentInOrg(id, req.organizationId!);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    await storageAdapter.download(
      attachment.fileName,
      attachment.originalName,
      attachment.mimeType || 'application/octet-stream',
      res
    );
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete an attachment
app.delete('/api/attachments/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!(await findAttachmentInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: { goal: { select: { id: true, title: true, projectId: true } } },
    });
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Delete file from storage
    await storageAdapter.delete(attachment.fileName);

    // Delete database record
    await prisma.attachment.delete({ where: { id } });

    // Audit log
    await (req as any).audit?.({
      action: 'DELETE',
      entityType: 'Attachment',
      entityId: id,
      entityTitle: attachment.originalName,
      goalId: attachment.goalId,
      projectId: attachment.goal?.projectId,
      summary: `'${attachment.goal?.title}'에서 첨부파일 '${attachment.originalName}' 삭제`,
    });

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// Users endpoint - list organization members for owner autocomplete
app.get('/api/users', async (req: AuthRequest, res: Response) => {
  try {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: req.organizationId },
      include: {
        user: { select: { id: true, name: true, picture: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
    res.json(members.map(m => m.user));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Settings endpoints
app.get('/api/settings', async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { organizationId: req.organizationId },
    });
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    // Set defaults if not found
    const defaults = {
      dashboardTitle: process.env.DASHBOARD_TITLE || 'Mokpyo',
      dashboardSubtitle: process.env.DASHBOARD_SUBTITLE || '',
    };

    res.json({ ...defaults, ...settingsObj });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/settings', async (req: AuthRequest, res: Response) => {
  try {
    // Only ADMIN or OWNER can change settings
    if (req.memberRole === 'MEMBER') {
      return res.status(403).json({ error: '설정 변경은 관리자 이상만 가능합니다.' });
    }

    const { dashboardTitle, dashboardSubtitle } = req.body;
    const orgId = req.organizationId!;

    if (dashboardTitle !== undefined) {
      await prisma.setting.upsert({
        where: { key_organizationId: { key: 'dashboardTitle', organizationId: orgId } },
        update: { value: dashboardTitle },
        create: { key: 'dashboardTitle', value: dashboardTitle, organizationId: orgId },
      });
    }

    if (dashboardSubtitle !== undefined) {
      await prisma.setting.upsert({
        where: { key_organizationId: { key: 'dashboardSubtitle', organizationId: orgId } },
        update: { value: dashboardSubtitle },
        create: { key: 'dashboardSubtitle', value: dashboardSubtitle, organizationId: orgId },
      });
    }

    // Audit log
    await (req as any).audit?.({
      action: 'UPDATE',
      entityType: 'Setting',
      entityId: 'dashboard',
      entityTitle: 'Dashboard Settings',
      changes: JSON.stringify({ dashboardTitle, dashboardSubtitle }),
    });

    const settings = await prisma.setting.findMany({
      where: { organizationId: orgId },
    });
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    res.json(settingsObj);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============================================================
// AI Report & Summarize Endpoints
// ============================================================

// AI 상태 확인
app.get('/api/ai/status', (req: Request, res: Response) => {
  res.json({ available: isAIAvailable() });
});

// 리포트 생성
app.post('/api/ai/report', async (req: AuthRequest, res: Response) => {
  try {
    if (!isAIAvailable()) {
      return res.status(503).json({ error: 'AI 서비스가 설정되지 않았습니다.' });
    }

    const { projectId, period, startDate, endDate, templateId } = req.body;
    if (!projectId || !period) {
      return res.status(400).json({ error: 'projectId와 period는 필수입니다.' });
    }

    if (!(await findProjectInOrg(projectId, req.organizationId!))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 날짜 범위 계산
    const now = new Date();
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (period === 'weekly') {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      end = now;
    } else {
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      end = now;
    }
    end.setHours(23, 59, 59, 999);

    // AuditLog 조회
    const logs = await prisma.auditLog.findMany({
      where: {
        projectId,
        organizationId: req.organizationId,
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Goal 현재 상태 조회
    const goals = await prisma.goal.findMany({
      where: { projectId, project: { organizationId: req.organizationId } },
      include: {
        categories: { select: { name: true } },
        subGoals: {
          select: {
            title: true,
            progress: true,
            owner: true,
            subGoalOwners: { orderBy: { order: 'asc' }, select: { ownerName: true } },
          },
        },
        goalOwners: { orderBy: { order: 'asc' }, select: { ownerName: true } },
      },
    });

    const goalsForPrompt = goals.map((g: any) => ({
      title: g.title,
      progress: g.progress,
      owner: g.goalOwners?.length > 0 ? g.goalOwners[0].ownerName : g.owner,
      owners: g.goalOwners?.length > 0 ? g.goalOwners.map((o: any) => o.ownerName) : (g.owner ? [g.owner] : []),
      dueDate: g.dueDate,
      categories: g.categories.map((c: any) => c.name),
      subGoals: g.subGoals.map((s: any) => ({
        title: s.title,
        progress: s.progress,
        owner: s.subGoalOwners?.length > 0 ? s.subGoalOwners[0].ownerName : s.owner,
        owners: s.subGoalOwners?.length > 0 ? s.subGoalOwners.map((o: any) => o.ownerName) : (s.owner ? [s.owner] : []),
      })),
    }));

    // 템플릿 처리
    let templateInstruction = '';
    if (templateId) {
      const template = await findReportTemplateInOrg(templateId, req.organizationId!);
      if (template) {
        templateInstruction = `\n\n## 리포트 양식\n아래 양식의 구조와 형식에 맞춰 리포트를 작성해주세요:\n---\n${template.extractedText}\n---`;
      }
    }

    const periodLabel = period === 'weekly' ? '주간' : '월간';
    const startStr = start.toLocaleDateString('ko-KR');
    const endStr = end.toLocaleDateString('ko-KR');

    const systemPrompt = `당신은 프로젝트 관리 리포트를 작성하는 전문가입니다.
주어진 활동 내역과 목표 현황을 분석하여 ${periodLabel} 리포트를 마크다운 형식으로 작성해주세요.
리포트에는 다음 내용을 포함해야 합니다:
1. 기간 요약 (주요 성과와 변경사항)
2. 목표별 진행 현황
3. 주요 활동 내역
4. 향후 계획/제안사항${templateInstruction}`;

    const userPrompt = `## 리포트 기간: ${startStr} ~ ${endStr}

## 현재 목표 현황
${formatGoalsForPrompt(goalsForPrompt)}

## 기간 내 활동 내역 (${logs.length}건)
${compressAuditLogs(logs)}`;

    // SSE 스트리밍 응답
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 메타데이터를 먼저 전송
    const metadata = {
      period: periodLabel,
      startDate: startStr,
      endDate: endStr,
      logCount: logs.length,
      goalCount: goals.length,
    };
    res.write(`data: ${JSON.stringify({ type: 'metadata', metadata })}\n\n`);

    // 스트리밍으로 리포트 생성
    await chatCompletionStream(
      systemPrompt,
      userPrompt,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      { maxTokens: 8192, timeoutMs: 300000 }
    );

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Error generating report:', error);
    // SSE 헤더가 이미 보내졌을 수 있으므로 분기 처리
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || '리포트 생성에 실패했습니다.' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || '리포트 생성에 실패했습니다.' })}\n\n`);
      res.end();
    }
  }
});

// 변경 이력 요약
app.post('/api/ai/summarize-activity', async (req: AuthRequest, res: Response) => {
  try {
    if (!isAIAvailable()) {
      return res.status(503).json({ error: 'AI 서비스가 설정되지 않았습니다.' });
    }

    const { activityIds } = req.body;
    if (!activityIds || !Array.isArray(activityIds) || activityIds.length === 0) {
      return res.status(400).json({ error: 'activityIds 배열이 필요합니다.' });
    }

    const logs = await prisma.auditLog.findMany({
      where: { id: { in: activityIds }, organizationId: req.organizationId },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) {
      return res.status(404).json({ error: '활동 내역을 찾을 수 없습니다.' });
    }

    const systemPrompt = `당신은 프로젝트 활동 내역을 간결하고 읽기 쉽게 요약하는 전문가입니다.
주어진 활동 내역을 분석하여 자연어로 요약해주세요. 핵심적인 변경사항 위주로 간결하게 작성하세요.
한국어로 작성하세요.`;

    const userPrompt = `다음 활동 내역을 요약해주세요:\n\n${compressAuditLogs(logs)}`;

    // SSE 스트리밍 응답
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await chatCompletionStream(
      systemPrompt,
      userPrompt,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      { maxTokens: 4096, timeoutMs: 300000 }
    );

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Error summarizing activity:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || '활동 요약에 실패했습니다.' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || '활동 요약에 실패했습니다.' })}\n\n`);
      res.end();
    }
  }
});

// ============================================================
// Report Template CRUD
// ============================================================

// 템플릿 목록
app.get('/api/report-templates', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const where: any = { organizationId: req.organizationId };
    if (projectId) {
      where.OR = [{ projectId: projectId as string }, { projectId: null }];
    }

    const templates = await prisma.reportTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching report templates:', error);
    res.status(500).json({ error: 'Failed to fetch report templates' });
  }
});

// 템플릿 생성 (PDF 업로드)
app.post('/api/report-templates', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;

    const file = req.file;
    const { name, description, projectId } = req.body;

    if (!name) {
      return res.status(400).json({ error: '템플릿 이름은 필수입니다.' });
    }

    let extractedText = '';
    let originalFileName: string | undefined;
    let savedFileName: string | undefined;

    if (file) {
      originalFileName = decodeMultipartFilename(file.originalname);

      // PDF에서 텍스트 추출
      const fileBuffer = file.buffer || (await import('fs')).readFileSync(file.path);
      const pdfData = await pdfParse(fileBuffer);
      extractedText = pdfData.text || '';

      // 스토리지에 원본 PDF 저장
      savedFileName = await storageAdapter.upload(file);
    }

    if (!extractedText) {
      return res.status(400).json({ error: 'PDF에서 텍스트를 추출할 수 없습니다. PDF 파일을 확인해주세요.' });
    }

    const template = await prisma.reportTemplate.create({
      data: {
        name,
        description: description || null,
        extractedText,
        originalFileName: originalFileName || null,
        fileName: savedFileName || null,
        projectId: projectId || null,
        organizationId: req.organizationId,
      },
    });

    res.json(template);
  } catch (error) {
    console.error('Error creating report template:', error);
    if (req.file) {
      try { await storageAdapter.delete(req.file.filename); } catch {}
    }
    res.status(500).json({ error: 'Failed to create report template' });
  }
});

// 템플릿 삭제
app.delete('/api/report-templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireRole(req, res, ['OWNER', 'ADMIN'])) return;

    const { id } = req.params;

    if (!(await findReportTemplateInOrg(id, req.organizationId!))) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // 스토리지에서 PDF 삭제
    if (template.fileName) {
      try { await storageAdapter.delete(template.fileName); } catch {}
    }

    await prisma.reportTemplate.delete({ where: { id } });
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting report template:', error);
    res.status(500).json({ error: 'Failed to delete report template' });
  }
});

// Run status/flags resync on server start (replaces the old migrateCompletedField sweep).
// resyncAllGoalStatuses backfills NULL statusId and reconciles completed/onHold FROM the
// label kind (statusId is authoritative) — it never recomputes completed from progress.
export async function startServer(): Promise<void> {
  await resyncAllGoalStatuses();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mokpyo API v${APP_VERSION} listening on http://0.0.0.0:${PORT} (${process.env.NODE_ENV || 'development'})`);
    startDueSoonScheduler();
    startAutomationScheduler();
  });

  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}
