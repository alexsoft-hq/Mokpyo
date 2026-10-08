import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStatusLabel, mockGoal, mockOrg } = vi.hoisted(() => ({
  mockStatusLabel: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), createMany: vi.fn() },
  mockGoal: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  mockOrg: { findMany: vi.fn() },
}));

vi.mock('./prisma', () => ({
  prisma: { statusLabel: mockStatusLabel, goal: mockGoal, organization: mockOrg },
}));

import { flagsForKind, setGoalStatus, syncStatusFromFlags, resolveInitialStatus } from './statusSync';

const LABELS = [
  { id: 'l_ns', organizationId: 'org1', name: '시작 전', kind: 'active', order: 0, isSystem: true },
  { id: 'l_ip', organizationId: 'org1', name: '진행 중', kind: 'active', order: 1, isSystem: true },
  { id: 'l_risk', organizationId: 'org1', name: '위험', kind: 'active', order: 2, isSystem: false },
  { id: 'l_hold', organizationId: 'org1', name: '보류', kind: 'on_hold', order: 3, isSystem: true },
  { id: 'l_done', organizationId: 'org1', name: '완료', kind: 'done', order: 4, isSystem: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockStatusLabel.findMany.mockResolvedValue(LABELS);
  mockStatusLabel.count.mockResolvedValue(LABELS.length);
});

describe('flagsForKind', () => {
  it('done→completed, on_hold→onHold, active→neither', () => {
    expect(flagsForKind('done')).toEqual({ completed: true, onHold: false });
    expect(flagsForKind('on_hold')).toEqual({ completed: false, onHold: true });
    expect(flagsForKind('active')).toEqual({ completed: false, onHold: false });
  });
});

describe('setGoalStatus (권위 경로: 라벨 → 플래그)', () => {
  it('완료 라벨 설정 시 completed=true, onHold=false 미러', async () => {
    mockStatusLabel.findFirst.mockResolvedValue(LABELS[4]); // 완료
    mockGoal.update.mockResolvedValue({});
    const r = await setGoalStatus('g1', 'l_done', 'org1', { bumpVersion: true });
    expect(r).toEqual({ statusId: 'l_done', completed: true, onHold: false, kind: 'done' });
    expect(mockGoal.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ statusId: 'l_done', completed: true, onHold: false, version: { increment: 1 } }),
    }));
  });

  it('타 조직 라벨이면 throw (org 검증)', async () => {
    mockStatusLabel.findFirst.mockResolvedValue(null);
    await expect(setGoalStatus('g1', 'l_x', 'org1')).rejects.toThrow('STATUS_LABEL_NOT_IN_ORG');
  });
});

describe('syncStatusFromFlags (미러 경로: 플래그 → 라벨)', () => {
  it('completed → 완료 라벨', async () => {
    mockGoal.findUnique.mockResolvedValue({ statusId: 'l_ip', progress: 50, completed: false, onHold: false });
    mockGoal.update.mockResolvedValue({});
    const r = await syncStatusFromFlags('g1', { completed: true }, 'org1');
    expect(r).toBe('l_done');
  });

  it('active 상태에서 현재 라벨이 active(위험)면 보존 — write 안 함', async () => {
    mockGoal.findUnique.mockResolvedValue({ statusId: 'l_risk', progress: 40, completed: false, onHold: false });
    const r = await syncStatusFromFlags('g1', { completed: false, onHold: false }, 'org1');
    expect(r).toBe('l_risk');
    expect(mockGoal.update).not.toHaveBeenCalled();
  });

  it('완료 해제(현재 완료 라벨) → progress>0 이면 진행 중으로', async () => {
    mockGoal.findUnique.mockResolvedValue({ statusId: 'l_done', progress: 60, completed: false, onHold: false });
    mockGoal.update.mockResolvedValue({});
    const r = await syncStatusFromFlags('g1', { completed: false }, 'org1');
    expect(r).toBe('l_ip');
  });
});

describe('resolveInitialStatus (생성 시)', () => {
  it('요청 statusId 가 조직 소속이면 그 kind 로 플래그', async () => {
    const r = await resolveInitialStatus('org1', { requestedStatusId: 'l_hold' });
    expect(r).toEqual({ statusId: 'l_hold', completed: false, onHold: true });
  });

  it('statusId 없고 progress 100 → 완료 앵커', async () => {
    const r = await resolveInitialStatus('org1', { progress: 100 });
    expect(r).toEqual({ statusId: 'l_done', completed: true, onHold: false });
  });

  it('statusId 없고 progress 0 → 시작 전', async () => {
    const r = await resolveInitialStatus('org1', { progress: 0 });
    expect(r).toEqual({ statusId: 'l_ns', completed: false, onHold: false });
  });
});
