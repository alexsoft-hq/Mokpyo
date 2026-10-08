import { describe, it, expect } from 'vitest';
import { matchesTrigger } from './triggers';
import { passesConditions } from './conditions';
import { AutomationEvent, GoalSnapshot } from './types';

const baseEvent = (over: Partial<AutomationEvent>): AutomationEvent => ({
  type: 'goal_created', organizationId: 'o', projectId: 'p', goalId: 'g',
  changes: {}, depth: 0, visitedRuleIds: [], eventId: 'e1', ...over,
});

describe('matchesTrigger', () => {
  it('타입 불일치면 false', () => {
    expect(matchesTrigger({ id: 'r', triggerType: 'status_changed', triggerConfig: {}, condition: null, actions: [] }, baseEvent({ type: 'goal_created' }))).toBe(false);
  });

  it('status_changed: toStatusId 필터', () => {
    const rule = { id: 'r', triggerType: 'status_changed', triggerConfig: { toStatusId: 'done' }, condition: null, actions: [] };
    expect(matchesTrigger(rule, baseEvent({ type: 'status_changed', changes: { statusId: { from: 'ip', to: 'done' } } }))).toBe(true);
    expect(matchesTrigger(rule, baseEvent({ type: 'status_changed', changes: { statusId: { from: 'ip', to: 'hold' } } }))).toBe(false);
  });

  it('progress_reached: 상향 교차만(from<threshold<=to)', () => {
    const rule = { id: 'r', triggerType: 'progress_reached', triggerConfig: { threshold: 80 }, condition: null, actions: [] };
    expect(matchesTrigger(rule, baseEvent({ type: 'progress_reached', changes: { progress: { from: 50, to: 90 } } }))).toBe(true);
    expect(matchesTrigger(rule, baseEvent({ type: 'progress_reached', changes: { progress: { from: 85, to: 90 } } }))).toBe(false); // 이미 넘어있음
    expect(matchesTrigger(rule, baseEvent({ type: 'progress_reached', changes: { progress: { from: 90, to: 60 } } }))).toBe(false); // 하향
  });

  it('assignee_changed: userId 필터', () => {
    const rule = { id: 'r', triggerType: 'assignee_changed', triggerConfig: { userId: 'u2' }, condition: null, actions: [] };
    expect(matchesTrigger(rule, baseEvent({ type: 'assignee_changed', changes: { assigneesAdded: ['u2'] } }))).toBe(true);
    expect(matchesTrigger(rule, baseEvent({ type: 'assignee_changed', changes: { assigneesAdded: ['u3'] } }))).toBe(false);
    expect(matchesTrigger(rule, baseEvent({ type: 'assignee_changed', changes: { assigneesAdded: [] } }))).toBe(false);
  });
});

const snap = (over: Partial<GoalSnapshot>): GoalSnapshot => ({
  id: 'g', title: 't', projectId: 'p', statusId: 'ip', progress: 50, completed: false, onHold: false,
  size: 'medium', categoryIds: ['c1'], customFields: {}, ...over,
});

describe('passesConditions', () => {
  it('조건 없으면 통과', () => {
    expect(passesConditions({ id: 'r', triggerType: 't', triggerConfig: {}, condition: null, actions: [] }, snap({}))).toBe(true);
  });
  it('eq/neq/in + AND', () => {
    const rule = (c: any) => ({ id: 'r', triggerType: 't', triggerConfig: {}, condition: c, actions: [] });
    expect(passesConditions(rule([{ attr: 'size', op: 'eq', value: 'medium' }]), snap({}))).toBe(true);
    expect(passesConditions(rule([{ attr: 'size', op: 'eq', value: 'xl' }]), snap({}))).toBe(false);
    expect(passesConditions(rule([{ attr: 'statusId', op: 'neq', value: 'done' }]), snap({}))).toBe(true);
    expect(passesConditions(rule([{ attr: 'categoryId', op: 'in', value: ['c1', 'c9'] }]), snap({}))).toBe(true);
    // AND: 둘 중 하나 실패
    expect(passesConditions(rule([{ attr: 'size', op: 'eq', value: 'medium' }, { attr: 'statusId', op: 'eq', value: 'done' }]), snap({}))).toBe(false);
  });
  it('field:<id> 커스텀 필드 조건', () => {
    const rule = { id: 'r', triggerType: 't', triggerConfig: {}, condition: [{ attr: 'field:f1', op: 'eq', value: 'high' }], actions: [] };
    expect(passesConditions(rule, snap({ customFields: { f1: 'high' } }))).toBe(true);
    expect(passesConditions(rule, snap({ customFields: { f1: 'low' } }))).toBe(false);
  });
});
