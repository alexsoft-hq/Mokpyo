import { Tag } from 'lucide-react';
import { useFieldSchema } from '@/hooks/useFieldSchema';
import { OptionChip } from '@/components/common/StatusPill';
import { CustomFieldDefinition, DropdownOption, PersonValue } from '@/types/fields';

/**
 * 목표의 커스텀 필드 값을 읽기 전용으로 표시. GoalViewDialog 개요에 삽입 —
 * 커스텀 필드가 /table 에서만 보이던 구멍을 막는다(적대적 검증 medium). 정의가 없으면 렌더 안 함.
 */
export function CustomFieldsSection({ customFields }: { customFields?: Record<string, unknown> }) {
  const { data: schema } = useFieldSchema();
  const defs = schema?.customFields ?? [];
  if (defs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Tag className="h-4 w-4" />
        커스텀 필드
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {defs.map((def) => (
          <div key={def.id} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{def.name}</span>
            <FieldValue def={def} value={customFields?.[def.id]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldValue({ def, value }: { def: CustomFieldDefinition; value: unknown }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }
  const options: DropdownOption[] = def.config?.options ?? [];

  if (def.type === 'number') {
    return <span className="text-sm">{String(value)}{def.config?.unit ? ` ${def.config.unit}` : ''}</span>;
  }
  if (def.type === 'text' || def.type === 'date') {
    return <span className="text-sm">{String(value)}</span>;
  }
  if (def.type === 'person') {
    const people = value as PersonValue[];
    return <span className="text-sm">{people.map((p) => p.name).join(', ')}</span>;
  }
  if (def.type === 'dropdown' || def.type === 'priority') {
    const ids = Array.isArray(value) ? (value as string[]) : [value as string];
    const opts = options.filter((o) => ids.includes(o.id));
    return (
      <div className="flex gap-1 flex-wrap">
        {opts.map((o) => <OptionChip key={o.id} label={o.label} color={o.color} />)}
      </div>
    );
  }
  return <span className="text-sm">{String(value)}</span>;
}
