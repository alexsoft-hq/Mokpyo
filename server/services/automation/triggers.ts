import { AutomationEvent, RuleLike } from './types';

/**
 * 규칙의 트리거가 이벤트와 일치하는지 판정(순수 함수 — 단위 테스트 대상).
 * triggerType 일치 + triggerConfig 세부 조건 검사.
 */
export function matchesTrigger(rule: RuleLike, event: AutomationEvent): boolean {
  if (rule.triggerType !== event.type) return false;
  const cfg = rule.triggerConfig || {};

  switch (event.type) {
    case 'goal_created':
      return true;

    case 'status_changed': {
      const to = event.changes.statusId?.to ?? null;
      const from = event.changes.statusId?.from ?? null;
      if (cfg.toStatusId && to !== cfg.toStatusId) return false;
      if (cfg.fromStatusId && from !== cfg.fromStatusId) return false;
      return true;
    }

    case 'assignee_changed': {
      const added = event.changes.assigneesAdded ?? [];
      if (added.length === 0) return false;
      if (cfg.userId && !added.includes(cfg.userId)) return false;
      return true;
    }

    case 'progress_reached': {
      // 상향 교차만: from < threshold <= to
      const threshold = typeof cfg.threshold === 'number' ? cfg.threshold : 100;
      const p = event.changes.progress;
      if (!p) return false;
      return p.from < threshold && p.to >= threshold;
    }

    case 'due_date_approaching':
    case 'due_date_arrived':
      return true; // 스케줄러가 대상 목표별로 생성하므로 여기선 타입 일치면 통과

    default:
      return false;
  }
}
