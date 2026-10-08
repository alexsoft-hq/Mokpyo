/**
 * Goal 변경 추적 유틸리티
 * 목표 수정 시 어떤 필드가 변경되었는지 상세하게 추적
 */

// 추적할 Goal 필드 정의
interface FieldDefinition {
  field: string;
  label: string;
  type: 'primitive' | 'text' | 'date';
  maxLength?: number;
}

const GOAL_FIELDS: FieldDefinition[] = [
  { field: 'title', label: '제목', type: 'primitive' },
  { field: 'progress', label: '진행률', type: 'primitive' },
  { field: 'description', label: '설명', type: 'text', maxLength: 100 },
  { field: 'owner', label: '담당자', type: 'primitive' },
  { field: 'size', label: '중요도', type: 'primitive' },
  { field: 'startDate', label: '시작일', type: 'date' },
  { field: 'dueDate', label: '종료일', type: 'date' },
  { field: 'statusNote', label: '상태 메모', type: 'text', maxLength: 50 },
];

// 중요도 레이블 변환
const SIZE_LABELS: Record<string, string> = {
  xs: '최저',
  small: '낮음',
  medium: '중간',
  large: '높음',
  xl: '최고',
};

// 변경된 필드 정보
export interface FieldChange {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  type: 'primitive' | 'text' | 'date';
}

// 하위 목표 변경 정보
export interface SubGoalChange {
  added?: Array<{ id: string; title: string }>;
  updated?: Array<{ id: string; title: string; changes: FieldChange[] }>;
  deleted?: Array<{ id: string; title: string }>;
}

// 메모 변경 정보
export interface NoteChange {
  added?: Array<{ id: string; content: string }>;
  updated?: Array<{ id: string; contentPreview: string }>;
  deleted?: Array<{ id: string; contentPreview: string }>;
}

// 전체 변경 데이터 구조
export interface ChangesData {
  fields?: FieldChange[];
  categories?: {
    added?: string[];
    removed?: string[];
  };
  subGoals?: SubGoalChange;
  notes?: NoteChange;
}

/**
 * 텍스트 미리보기 생성 (긴 텍스트 자르기)
 */
function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 날짜 값을 비교 가능한 문자열로 변환
 */
function normalizeDate(date: any): string | null {
  if (!date) return null;
  if (typeof date === 'string') {
    // ISO 문자열에서 날짜 부분만 추출
    return date.split('T')[0];
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return String(date);
}

/**
 * 날짜 포맷팅 (표시용)
 */
function formatDateForDisplay(date: any): string | null {
  if (!date) return null;
  const normalized = normalizeDate(date);
  if (!normalized) return null;

  const [year, month, day] = normalized.split('-');
  if (!year || !month) return normalized;

  return day ? `${year}년 ${parseInt(month)}월 ${parseInt(day)}일` : `${year}년 ${parseInt(month)}월`;
}

/**
 * 두 값이 실질적으로 같은지 비교
 */
function isEqual(oldVal: any, newVal: any, type: string): boolean {
  if (type === 'date') {
    return normalizeDate(oldVal) === normalizeDate(newVal);
  }

  // null/undefined 처리
  if (oldVal === null || oldVal === undefined) oldVal = '';
  if (newVal === null || newVal === undefined) newVal = '';

  // 문자열 비교
  return String(oldVal).trim() === String(newVal).trim();
}

/**
 * Goal 필드 변경 감지
 */
export function detectGoalChanges(
  currentGoal: Record<string, any>,
  newData: Record<string, any>
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const fieldDef of GOAL_FIELDS) {
    const { field, label, type, maxLength } = fieldDef;

    // 새 데이터에 해당 필드가 없으면 스킵
    if (!(field in newData)) continue;

    const oldValue = currentGoal[field];
    const newValue = newData[field];

    if (!isEqual(oldValue, newValue, type)) {
      let displayOldValue = oldValue;
      let displayNewValue = newValue;

      // 중요도(size) 레이블 변환
      if (field === 'size') {
        displayOldValue = SIZE_LABELS[oldValue] || oldValue || '없음';
        displayNewValue = SIZE_LABELS[newValue] || newValue || '없음';
      }
      // 날짜 포맷팅
      else if (type === 'date') {
        displayOldValue = formatDateForDisplay(oldValue) || '없음';
        displayNewValue = formatDateForDisplay(newValue) || '없음';
      }
      // 텍스트 잘라내기
      else if (type === 'text' && maxLength) {
        displayOldValue = truncateText(oldValue, maxLength) || '없음';
        displayNewValue = truncateText(newValue, maxLength) || '없음';
      }
      // 빈 값 처리
      else {
        displayOldValue = oldValue ?? '없음';
        displayNewValue = newValue ?? '없음';
      }

      // 진행률은 % 표시 추가
      if (field === 'progress') {
        displayOldValue = `${oldValue ?? 0}%`;
        displayNewValue = `${newValue ?? 0}%`;
      }

      changes.push({
        field,
        fieldLabel: label,
        oldValue: displayOldValue,
        newValue: displayNewValue,
        type,
      });
    }
  }

  return changes;
}

/**
 * 카테고리 변경 감지
 */
export function detectCategoryChanges(
  oldCategories: string[],
  newCategories: string[]
): { added?: string[]; removed?: string[] } | null {
  const oldSet = new Set(oldCategories);
  const newSet = new Set(newCategories);

  const added = newCategories.filter(c => !oldSet.has(c));
  const removed = oldCategories.filter(c => !newSet.has(c));

  if (added.length === 0 && removed.length === 0) {
    return null;
  }

  return {
    added: added.length > 0 ? added : undefined,
    removed: removed.length > 0 ? removed : undefined,
  };
}

/**
 * 하위 목표 변경 감지
 */
export function detectSubGoalChanges(
  currentSubGoals: Array<{ id: string; title: string; progress: number; owner?: string | null }>,
  newSubGoals: Array<{ id?: string; title: string; progress?: number; owner?: string | null }> | undefined
): SubGoalChange | null {
  if (!newSubGoals) return null;

  const currentMap = new Map(currentSubGoals.map(sg => [sg.id, sg]));
  const newIds = new Set(newSubGoals.filter(sg => sg.id).map(sg => sg.id));

  const result: SubGoalChange = {};

  // 삭제된 하위 목표
  const deleted = currentSubGoals
    .filter(sg => !newIds.has(sg.id))
    .map(sg => ({ id: sg.id, title: sg.title }));

  if (deleted.length > 0) {
    result.deleted = deleted;
  }

  // 추가된 하위 목표
  const added = newSubGoals
    .filter(sg => !sg.id || !currentMap.has(sg.id))
    .map(sg => ({ id: sg.id || 'new', title: sg.title }));

  if (added.length > 0) {
    result.added = added;
  }

  // 수정된 하위 목표
  const updated: Array<{ id: string; title: string; changes: FieldChange[] }> = [];

  for (const newSg of newSubGoals) {
    if (!newSg.id) continue;
    const currentSg = currentMap.get(newSg.id);
    if (!currentSg) continue;

    const changes: FieldChange[] = [];

    if (newSg.title !== currentSg.title) {
      changes.push({
        field: 'title',
        fieldLabel: '제목',
        oldValue: currentSg.title,
        newValue: newSg.title,
        type: 'primitive',
      });
    }

    if (newSg.progress !== undefined && newSg.progress !== currentSg.progress) {
      changes.push({
        field: 'progress',
        fieldLabel: '진행률',
        oldValue: `${currentSg.progress}%`,
        newValue: `${newSg.progress}%`,
        type: 'primitive',
      });
    }

    if (changes.length > 0) {
      updated.push({ id: newSg.id, title: newSg.title, changes });
    }
  }

  if (updated.length > 0) {
    result.updated = updated;
  }

  // 변경 사항이 없으면 null 반환
  if (!result.added && !result.deleted && !result.updated) {
    return null;
  }

  return result;
}

/**
 * 메모 변경 감지
 */
export function detectNoteChanges(
  currentNotes: Array<{ id: string; content: string }>,
  newNotes: Array<{ id?: string; content: string }> | undefined
): NoteChange | null {
  if (!newNotes) return null;

  const currentMap = new Map(currentNotes.map(n => [n.id, n]));
  const newIds = new Set(newNotes.filter(n => n.id).map(n => n.id));

  const result: NoteChange = {};

  // 삭제된 메모
  const deleted = currentNotes
    .filter(n => !newIds.has(n.id))
    .map(n => ({ id: n.id, contentPreview: truncateText(n.content, 30) }));

  if (deleted.length > 0) {
    result.deleted = deleted;
  }

  // 추가된 메모
  const added = newNotes
    .filter(n => !n.id || !currentMap.has(n.id))
    .map(n => ({ id: n.id || 'new', content: truncateText(n.content, 50) }));

  if (added.length > 0) {
    result.added = added;
  }

  // 수정된 메모 (content 변경 감지)
  const updated: Array<{ id: string; contentPreview: string }> = [];

  for (const newNote of newNotes) {
    if (!newNote.id) continue;
    const currentNote = currentMap.get(newNote.id);
    if (!currentNote) continue;

    if (newNote.content !== currentNote.content) {
      updated.push({
        id: newNote.id,
        contentPreview: truncateText(newNote.content, 30),
      });
    }
  }

  if (updated.length > 0) {
    result.updated = updated;
  }

  // 변경 사항이 없으면 null 반환
  if (!result.added && !result.deleted && !result.updated) {
    return null;
  }

  return result;
}

/**
 * 전체 변경 사항 조합
 */
export function buildChangesData(
  currentGoal: Record<string, any>,
  newGoalData: Record<string, any>,
  oldCategories: string[],
  newCategories: string[],
  currentSubGoals: Array<{ id: string; title: string; progress: number; owner?: string | null }>,
  newSubGoals: Array<{ id?: string; title: string; progress?: number; owner?: string | null }> | undefined,
  currentNotes: Array<{ id: string; content: string }>,
  newNotes: Array<{ id?: string; content: string }> | undefined
): ChangesData | null {
  const result: ChangesData = {};

  // 필드 변경
  const fieldChanges = detectGoalChanges(currentGoal, newGoalData);
  if (fieldChanges.length > 0) {
    result.fields = fieldChanges;
  }

  // 카테고리 변경
  const categoryChanges = detectCategoryChanges(oldCategories, newCategories);
  if (categoryChanges) {
    result.categories = categoryChanges;
  }

  // 하위 목표 변경
  const subGoalChanges = detectSubGoalChanges(currentSubGoals, newSubGoals);
  if (subGoalChanges) {
    result.subGoals = subGoalChanges;
  }

  // 메모 변경
  const noteChanges = detectNoteChanges(currentNotes, newNotes);
  if (noteChanges) {
    result.notes = noteChanges;
  }

  // 변경 사항이 없으면 null 반환
  if (!result.fields && !result.categories && !result.subGoals && !result.notes) {
    return null;
  }

  return result;
}
