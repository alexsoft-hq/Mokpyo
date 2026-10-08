// 자동화 도메인 이벤트 타입.

export type TriggerType =
  | 'goal_created'
  | 'status_changed'
  | 'assignee_changed'
  | 'progress_reached'
  | 'due_date_approaching'
  | 'due_date_arrived';

export interface EventChanges {
  statusId?: { from: string | null; to: string | null };
  progress?: { from: number; to: number };
  assigneesAdded?: string[]; // userId 목록
}

export interface AutomationEvent {
  type: TriggerType;
  organizationId: string;
  projectId: string;
  goalId: string;
  actor?: { userId: string | null; name: string };
  changes: EventChanges;
  depth: number;             // 루프 가드
  visitedRuleIds: string[];  // 이 체인에서 이미 실행된 규칙
  eventId: string;           // 멱등 키
}

// 조건/액션 검사용 목표 스냅샷(actions 실행 시점 로드)
export interface GoalSnapshot {
  id: string;
  title: string;
  projectId: string;
  statusId: string | null;
  progress: number;
  completed: boolean;
  onHold: boolean;
  size: string;
  categoryIds: string[];
  customFields: Record<string, unknown>;
}

export interface RuleLike {
  id: string;
  triggerType: string;
  triggerConfig: any;
  condition: any;
  actions: any;
}

export const MAX_DEPTH = 3;
