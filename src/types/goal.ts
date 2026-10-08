export type GoalCategory = string;
export type GoalSize = 'xs' | 'small' | 'medium' | 'large' | 'xl';

export interface Project {
  id: string;
  name: string;
  description?: string;
  dashboardTitle: string;
  dashboardSubtitle: string;
  parentId?: string | null;
  parent?: Project | null;
  children?: Project[];
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isPinned: boolean;
  version?: number;
}

export interface SubGoal {
  id: string;
  title: string;
  description?: string;
  owner: string;
  owners: string[];
  progress: number;
  startDate?: string;
  dueDate?: string;
  statusNote?: string;
  version?: number;
  // Key Result 정량 지표(선택). 값이 있으면 진행률이 (current-start)/(target-start)로 자동 산출됨.
  targetValue?: number | null;
  currentValue?: number | null;
  startValue?: number | null;
  unit?: string | null;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  owner: string;
  owners: string[];
  projectId?: string; // 프로젝트 ID
  project?: { id: string; name: string }; // 프로젝트 정보 (하위 포함 모드용)
  categories: GoalCategory[]; // 최소 1개, 최대 5개
  progress: number;
  size: GoalSize; // 카드 크기 = 중요도
  startDate?: string;
  dueDate?: string;
  statusNote?: string;
  subGoals?: SubGoal[];
  notes?: Note[]; // 메모 히스토리
  attachments?: Attachment[]; // 첨부파일
  order?: number; // 드래그 앤 드롭 순서
  completed?: boolean; // 완료 여부
  onHold?: boolean; // 보류 여부
  version?: number; // 낙관적 잠금을 위한 버전
  parentGoalId?: string | null; // 상위 목표(정렬/카스케이딩)
  cycleId?: string | null; // 소속 목표 주기(사이클)
  statusId?: string | null; // monday식 상태 라벨(FK). completed/onHold 는 이 라벨 kind의 미러
  customFields?: Record<string, unknown>; // 커스텀 필드 값 { [defId]: value }
}
