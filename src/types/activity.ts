// Field change tracking types
export interface FieldChange {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  type: 'primitive' | 'text' | 'date';
}

export interface SubGoalChange {
  added?: Array<{ id: string; title: string }>;
  updated?: Array<{ id: string; title: string; changes: FieldChange[] }>;
  deleted?: Array<{ id: string; title: string }>;
}

export interface NoteChange {
  added?: Array<{ id: string; content: string }>;
  updated?: Array<{ id: string; contentPreview: string }>;
  deleted?: Array<{ id: string; contentPreview: string }>;
}

export interface ChangesData {
  fields?: FieldChange[];
  categories?: {
    added?: string[];
    removed?: string[];
  };
  subGoals?: SubGoalChange;
  notes?: NoteChange;
}

// Activity Log Types
export interface ActivityLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REORDER';
  entityType: 'Goal' | 'SubGoal' | 'Note' | 'Category' | 'Attachment' | 'Project' | 'Setting';
  entityId: string;
  entityTitle?: string;
  goalId?: string;
  projectId?: string;
  summary?: string;
  ipAddress?: string;
  changes?: ChangesData | string;
  createdAt: string;
  displayName: string;
  user?: {
    name: string;
    picture?: string;
  };
}

// Action labels in Korean
export const ACTION_LABELS: Record<string, string> = {
  CREATE: '생성',
  UPDATE: '수정',
  DELETE: '삭제',
  REORDER: '순서 변경',
};

// Entity type labels in Korean
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  Goal: '목표',
  SubGoal: '하위 목표',
  Note: '메모',
  Category: '카테고리',
  Attachment: '첨부파일',
  Project: '프로젝트',
  Setting: '설정',
};

// Helper function to format activity for display
export function formatActivitySummary(activity: ActivityLog): string {
  if (activity.summary) {
    return activity.summary;
  }

  const action = ACTION_LABELS[activity.action] || activity.action;
  const entityType = ENTITY_TYPE_LABELS[activity.entityType] || activity.entityType;
  const entityTitle = activity.entityTitle || '';

  return `${entityType} '${entityTitle}' ${action}`;
}

// Helper function to format relative time
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return '방금 전';
  } else if (diffMin < 60) {
    return `${diffMin}분 전`;
  } else if (diffHour < 24) {
    return `${diffHour}시간 전`;
  } else if (diffDay < 7) {
    return `${diffDay}일 전`;
  } else {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}

// Group activities by date
export function groupActivitiesByDate(activities: ActivityLog[]): Record<string, ActivityLog[]> {
  const groups: Record<string, ActivityLog[]> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const activity of activities) {
    const activityDate = new Date(activity.createdAt);
    activityDate.setHours(0, 0, 0, 0);

    let groupKey: string;
    if (activityDate.getTime() === today.getTime()) {
      groupKey = '오늘';
    } else if (activityDate.getTime() === yesterday.getTime()) {
      groupKey = '어제';
    } else {
      groupKey = activityDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(activity);
  }

  return groups;
}
