import { t } from '@/i18n';
// 테이블 뷰의 CSV 내보내기.
// Excel(한국어 Windows 포함)이 UTF-8 로 열도록 BOM 을 붙이고, 줄바꿈은 CRLF 를 쓴다.

import { Goal, GoalSize } from '@/types/goal';
import { CustomFieldDefinition, PersonValue, StatusLabel } from '@/types/fields';

/** Excel 이 UTF-8 로 인식하게 하는 바이트 순서 표식 */
export const CSV_BOM = '\uFEFF';

const MULTI_VALUE_SEPARATOR = ';';

/** 테이블의 중요도 셀과 같은 라벨 */
export const SIZE_LABELS: Record<GoalSize, string> = {
  xl: '최고',
  large: '높음',
  medium: '중간',
  small: '낮음',
  xs: '최저',
};

export interface CsvCycle {
  id: string;
  name: string;
}

export interface GoalsToCsvOptions {
  fieldDefs?: CustomFieldDefinition[];
  statusLabels?: StatusLabel[];
  cycles?: CsvCycle[];
}

const BASE_HEADERS = [
  '제목',
  '상태',
  '담당자',
  '진행률',
  '중요도',
  '시작일',
  '마감일',
  '분류',
  '사이클',
];

/** 쉼표·따옴표·줄바꿈·앞뒤 공백이 있을 때만 큰따옴표로 감싸고, 안의 따옴표는 두 번 쓴다. */
export function escapeCsvCell(value: string): string {
  if (value === '') return '';
  const needsQuotes = /[",\r\n]/.test(value) || value !== value.trim();
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** 날짜는 YYYY-MM-DD 부분만 쓴다(ISO 문자열이 와도 잘라낸다). */
function formatDate(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).slice(0, 10);
}

/** 커스텀 필드 값을 화면에 보이는 문자열로 바꾼다. */
export function formatCustomFieldValue(def: CustomFieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';

  if (def.type === 'person') {
    if (!Array.isArray(value)) return '';
    return (value as PersonValue[])
      .map((p) => p?.name ?? '')
      .filter(Boolean)
      .join(MULTI_VALUE_SEPARATOR);
  }

  if (def.type === 'dropdown' || def.type === 'priority') {
    const options = def.config?.options ?? [];
    const ids = Array.isArray(value) ? (value as string[]) : [String(value)];
    return ids
      .map((id) => options.find((o) => o.id === id)?.label ?? '')
      .filter(Boolean)
      .join(MULTI_VALUE_SEPARATOR);
  }

  if (def.type === 'date') return formatDate(String(value));

  if (def.type === 'number') {
    const unit = def.config?.unit;
    return unit ? `${value} ${unit}` : String(value);
  }

  return String(value);
}

function statusText(goal: Goal, statusLabels: StatusLabel[]): string {
  const label = statusLabels.find((l) => l.id === goal.statusId);
  if (label) return label.name;
  if (goal.completed) return t("완료");
  if (goal.onHold) return t("보류");
  return '';
}

/** 목표 목록을 CSV 문자열(BOM 포함)로 변환한다. */
export function goalsToCsv(goals: Goal[], options: GoalsToCsvOptions = {}): string {
  const fieldDefs = options.fieldDefs ?? [];
  const statusLabels = options.statusLabels ?? [];
  const cycles = options.cycles ?? [];

  const headers = [...BASE_HEADERS.map(header => t(header)), ...fieldDefs.map((f) => f.name)];

  const rows = goals.map((goal) => {
    const owners = goal.owners && goal.owners.length > 0 ? goal.owners : goal.owner ? [goal.owner] : [];
    const base = [
      goal.title ?? '',
      statusText(goal, statusLabels),
      owners.join(MULTI_VALUE_SEPARATOR),
      String(goal.progress ?? 0),
      t(SIZE_LABELS[goal.size] ?? ''),
      formatDate(goal.startDate),
      formatDate(goal.dueDate),
      (goal.categories ?? []).join(MULTI_VALUE_SEPARATOR),
      cycles.find((c) => c.id === goal.cycleId)?.name ?? '',
    ];
    const custom = fieldDefs.map((def) => formatCustomFieldValue(def, goal.customFields?.[def.id]));
    return [...base, ...custom];
  });

  const lines = [headers, ...rows].map((cells) => cells.map(escapeCsvCell).join(','));
  return CSV_BOM + lines.join('\r\n');
}

/** 브라우저에서 CSV 파일을 내려받는다. */
export function downloadCsv(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** mokpyo-<프로젝트명>-<YYYYMMDD>.csv — 파일명에 못 쓰는 글자는 -로 바꾼다. */
export function csvFileName(projectName: string | undefined, date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const safeName = (projectName ?? '').trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
  return `mokpyo-${safeName || t("목표")}-${stamp}.csv`;
}
