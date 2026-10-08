import { describe, it, expect } from 'vitest';
import { checkLimit, getPlan, PLANS } from './plans';

const usage = { members: 30, pendingInvitations: 10, projects: 100, goals: 1000, attachmentBytes: 0 };

describe('self-hosted plan compatibility', () => {
  it('retains existing database plan IDs and falls back for unknown values', () => {
    expect(getPlan(null).id).toBe('FREE');
    expect(getPlan('ENTERPRISE').id).toBe('FREE');
    expect(getPlan('PRO').id).toBe('PRO');
  });

  it.each(['FREE', 'PRO', 'BUSINESS'] as const)('%s has no seat fees or license capacity limits even with legacy enforcement enabled', (id) => {
    const plan = PLANS[id];
    expect(plan.pricePerSeatKrw).toBe(0);
    expect(plan.limits).toEqual({ members: null, projects: null, attachmentBytes: null });
    expect(checkLimit('members', plan, usage, true).ok).toBe(true);
    expect(checkLimit('projects', plan, usage, true).ok).toBe(true);
    expect(plan.features.automations).toBe(true);
    expect(plan.features.prioritySupport).toBe(false);
  });

  it('still counts pending invitations when an operator defines a custom capacity', () => {
    const plan = { ...PLANS.FREE, limits: { ...PLANS.FREE.limits, members: 40 } };
    expect(checkLimit('members', plan, usage, true).ok).toBe(false);
    expect(checkLimit('members', plan, { ...usage, pendingInvitations: 9 }, true).ok).toBe(true);
    expect(checkLimit('members', plan, usage, false).ok).toBe(true);
  });
});
