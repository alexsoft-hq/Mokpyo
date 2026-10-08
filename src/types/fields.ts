// monday.com식 상태 라벨 + 커스텀 필드 타입 (백엔드 field-schema 응답과 정합).

export type StatusKind = 'active' | 'done' | 'on_hold';

export interface StatusLabel {
  id: string;
  organizationId: string;
  name: string;
  color: string; // hex
  kind: StatusKind;
  order: number;
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'person' | 'dropdown' | 'priority';

export interface DropdownOption {
  id: string;
  label: string;
  color?: string;
}

export interface CustomFieldConfig {
  options?: DropdownOption[];
  multi?: boolean;
  unit?: string;
  precision?: number;
}

export interface CustomFieldDefinition {
  id: string;
  projectId: string;
  name: string;
  type: CustomFieldType;
  config: CustomFieldConfig;
  order: number;
}

export interface FieldSchema {
  statusLabels: StatusLabel[];
  customFields: CustomFieldDefinition[];
}

// person 필드 값 형태
export interface PersonValue {
  userId: string | null;
  name: string;
}
