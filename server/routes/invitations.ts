import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { checkLimit, getPlan, getOrgUsage } from '../lib/plans';
import { AuthRequest } from '../middleware/auth';
import { authenticateJWT } from '../middleware/auth';
import nodemailer from 'nodemailer';

const router = Router();

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : null;

async function sendInvitationEmail(to: string, inviterName: string, orgName: string, token: string): Promise<void> {
  const fromName = process.env.SMTP_FROM_NAME || 'Mokpyo';
  const from = process.env.SMTP_FROM
    ? `"${fromName}" <${process.env.SMTP_FROM}>`
    : `"${fromName}" <noreply@mokpyo.local>`;

  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  const inviteUrl = `${baseUrl}/invite/${token}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #4F46E5;">워크스페이스 초대</h2>
      <p><strong>${inviterName}</strong>님이 <strong>${orgName}</strong> 워크스페이스에 초대했습니다.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteUrl}" style="background: #4F46E5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          초대 수락하기
        </a>
      </div>
      <p style="color: #6B7280; font-size: 14px;">이 초대는 7일 동안 유효합니다.</p>
      <p style="color: #6B7280; font-size: 14px;">본인이 요청하지 않은 경우 이 이메일을 무시하세요.</p>
    </div>
  `;

  if (transporter) {
    await transporter.sendMail({
      from,
      to,
      subject: `[Mokpyo] ${inviterName}님이 ${orgName} 워크스페이스에 초대했습니다`,
      html,
    });
  } else {
    console.log(`[Invitation] SMTP not configured. Invite link for ${to}: ${inviteUrl}`);
  }
}

// POST /api/invitations — Create invitation (requires auth + org context via body)
router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, email, role } = req.body;

    if (!organizationId || !email) {
      return res.status(400).json({ error: 'organizationId and email are required' });
    }

    // Check inviter has ADMIN or OWNER role
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: req.user!.userId },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Admin or owner access required' });
    }

    // 역할 검증 + 권한 상승 방지: 유효 역할만, 그리고 OWNER 초대는 OWNER 만 가능(ADMIN 은 OWNER 발급 불가)
    const requestedRole = role || 'MEMBER';
    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(requestedRole)) {
      return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
    }
    if (requestedRole === 'OWNER' && membership.role !== 'OWNER') {
      return res.status(403).json({ error: '소유자(OWNER) 초대는 소유자만 발급할 수 있습니다.' });
    }

    // 플랜 좌석 한도(대기 중 초대 포함). 베타에서는 PLAN_ENFORCEMENT=true 일 때만 강제.
    const orgForPlan = await prisma.organization.findUnique({ where: { id: organizationId }, select: { plan: true } });
    const seatCheck = checkLimit('members', getPlan(orgForPlan?.plan), await getOrgUsage(organizationId));
    if (!seatCheck.ok) {
      return res.status(402).json({ error: seatCheck.message, code: 'PLAN_LIMIT', limit: seatCheck.limit, current: seatCheck.current });
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: existingUser.id },
        },
      });
      if (existingMember) {
        return res.status(400).json({ error: 'User is already a member of this organization' });
      }
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.invitation.findUnique({
      where: { organizationId_email: { organizationId, email } },
    });
    if (existingInvite && !existingInvite.acceptedAt) {
      // Update existing invitation
      const updated = await prisma.invitation.update({
        where: { id: existingInvite.id },
        data: {
          role: requestedRole,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          invitedById: req.user!.userId,
        },
      });

      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      await sendInvitationEmail(email, req.user!.name, org!.name, updated.token);

      return res.json(updated);
    }

    const invitation = await prisma.invitation.create({
      data: {
        organizationId,
        email,
        role: requestedRole,
        invitedById: req.user!.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    await sendInvitationEmail(email, req.user!.name, org!.name, invitation.token);

    res.status(201).json(invitation);
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// GET /api/invitations/:token — Get invitation info (public, no auth required)
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        invitedBy: { select: { name: true } },
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.acceptedAt) {
      return res.status(400).json({ error: 'Invitation already accepted' });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    res.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organization: invitation.organization,
      invitedBy: invitation.invitedBy.name,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    res.status(500).json({ error: 'Failed to fetch invitation' });
  }
});

// POST /api/invitations/:token/accept — Accept invitation (requires auth)
router.post('/:token/accept', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.acceptedAt) {
      return res.status(400).json({ error: 'Invitation already accepted' });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Verify the accepting user's email matches the invitation
    if (invitation.email !== req.user!.email) {
      return res.status(403).json({ error: 'This invitation was sent to a different email address' });
    }

    // Check if already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: req.user!.userId,
        },
      },
    });

    if (existingMember) {
      // Mark invitation as accepted even if already a member
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return res.json({
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
        alreadyMember: true,
      });
    }

    // Add as member and mark invitation as accepted
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: req.user!.userId,
          role: invitation.role,
        },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    res.json({
      organizationId: invitation.organizationId,
      organizationName: invitation.organization.name,
      role: invitation.role,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// DELETE /api/invitations/:id — Cancel invitation (requires auth + admin)
router.delete('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const invitation = await prisma.invitation.findUnique({ where: { id } });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check inviter has ADMIN or OWNER role
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: req.user!.userId,
        },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Admin or owner access required' });
    }

    await prisma.invitation.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling invitation:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

// GET /api/invitations/org/:orgId — List pending invitations for an org (requires auth + admin)
router.get('/org/:orgId', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: req.user!.userId },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Admin or owner access required' });
    }

    const invitations = await prisma.invitation.findMany({
      where: { organizationId: orgId, acceptedAt: null },
      include: {
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.invitedBy.name,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    })));
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

export default router;
