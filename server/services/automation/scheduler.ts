import { prisma } from '../../lib/prisma';
import { emitDomainEvent } from './engine';

// 날짜 트리거 스캐너. 기존 startDueSoonScheduler(알림)와 별개로 자동화 규칙 전용.
// 결정적 eventId 로 하루 1회만 발화(멱등 게이트 재사용).

async function scanDateTriggers(now = new Date()): Promise<void> {
  const todayStr = now.toISOString().slice(0, 10);

  const rules = await prisma.automationRule.findMany({
    where: { enabled: true, triggerType: { in: ['due_date_approaching', 'due_date_arrived'] } },
  });

  for (const rule of rules) {
    const cfg = (rule.triggerConfig as any) || {};
    let lo: string, hi: string;
    if (rule.triggerType === 'due_date_arrived') {
      lo = todayStr; hi = todayStr; // 오늘 마감
    } else {
      const daysBefore = typeof cfg.daysBefore === 'number' ? cfg.daysBefore : 3;
      lo = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);   // 내일부터
      hi = new Date(now.getTime() + daysBefore * 86400000).toISOString().slice(0, 10);
    }

    const goals = await prisma.goal.findMany({
      where: { projectId: rule.projectId, completed: false, onHold: false, dueDate: { gte: lo, lte: hi } },
      select: { id: true, dueDate: true },
    });

    for (const g of goals) {
      emitDomainEvent({
        type: rule.triggerType as any,
        organizationId: rule.organizationId,
        projectId: rule.projectId,
        goalId: g.id,
        actor: { userId: null, name: '자동화' },
        changes: {},
        // 결정적 키: 규칙+목표+마감일당 1회
        eventId: `sched:${rule.id}:${g.id}:${rule.triggerType}:${g.dueDate}`,
      });
    }
  }
}

export function startAutomationScheduler(intervalMs = 15 * 60 * 1000): void {
  const run = () => scanDateTriggers().catch((e) => console.error('automation scheduler failed:', e));
  setTimeout(run, 45000); // due-soon 스캐너와 시차
  setInterval(run, intervalMs);
}
