import { GoalSize } from '@/types/goal';

/**
 * 중요도(size)에 따른 색상 반환
 */
export const getPriorityColor = (size: GoalSize): string => {
  switch (size) {
    case 'xl':
      return '#ef4444'; // red-500 (최고)
    case 'large':
      return '#f97316'; // orange-500 (높음)
    case 'medium':
      return '#eab308'; // yellow-500 (중간)
    case 'small':
      return '#3b82f6'; // blue-500 (낮음)
    case 'xs':
      return '#9ca3af'; // gray-400 (최저)
    default:
      return '#eab308'; // yellow-500 (기본: 중간)
  }
};

/**
 * 중요도 레이블 반환
 */
export const getPriorityLabel = (size: GoalSize): string => {
  switch (size) {
    case 'xl':
      return '최고';
    case 'large':
      return '높음';
    case 'medium':
      return '중간';
    case 'small':
      return '낮음';
    case 'xs':
      return '최저';
    default:
      return '중간';
  }
};

/**
 * 중요도에 따른 아이콘 타입 반환 (JIRA 스타일)
 * - xl/large: 위 화살표 (double/single)
 * - medium: 가로줄
 * - small/xs: 아래 화살표 (single/double)
 */
export type PriorityIconType = 'chevronsUp' | 'chevronUp' | 'minus' | 'chevronDown' | 'chevronsDown';

export const getPriorityIconType = (size: GoalSize): PriorityIconType => {
  switch (size) {
    case 'xl':
      return 'chevronsUp';
    case 'large':
      return 'chevronUp';
    case 'medium':
      return 'minus';
    case 'small':
      return 'chevronDown';
    case 'xs':
      return 'chevronsDown';
    default:
      return 'minus';
  }
};
