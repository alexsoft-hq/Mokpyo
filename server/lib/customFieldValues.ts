/**
 * Single validation point for Goal.customFields JSONB writes.
 * Values are keyed by CustomFieldDefinition id; each is validated against its
 * definition's type + config. Unknown defIds are dropped; deleted dropdown
 * options are tolerated on read but rejected on write.
 */

export interface FieldDef {
  id: string;
  type: string; // text | number | date | person | dropdown | priority
  config: unknown; // Json — { options?: [{id,label,color}], multi?: bool, unit?, precision? }
}

interface Config {
  options?: { id: string; label: string; color?: string }[];
  multi?: boolean;
}

function asConfig(c: unknown): Config {
  return c && typeof c === 'object' ? (c as Config) : {};
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * incoming(부분 업데이트)을 current에 검증·병합해 새 customFields 객체를 반환.
 * value 가 null 이면 해당 키 삭제. 검증 실패 시 Error(message에 사유).
 * @param orgMemberIds person 필드 userId 검증용(조직 멤버 id 집합). 없으면 person userId 검증 생략.
 */
export function validateAndMergeFieldValues(
  defs: FieldDef[],
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
  orgMemberIds?: Set<string>
): Record<string, unknown> {
  const defById = new Map(defs.map((d) => [d.id, d]));
  const merged: Record<string, unknown> = { ...current };

  for (const [defId, raw] of Object.entries(incoming)) {
    const def = defById.get(defId);
    if (!def) continue; // 알 수 없는 필드 정의 → 무시(정의 삭제 대비)

    if (raw === null || raw === undefined) {
      delete merged[defId];
      continue;
    }

    merged[defId] = validateValue(def, raw, orgMemberIds);
  }
  return merged;
}

function validateValue(def: FieldDef, raw: unknown, orgMemberIds?: Set<string>): unknown {
  const cfg = asConfig(def.config);
  switch (def.type) {
    case 'text':
      if (typeof raw !== 'string') throw new Error(`필드 '${def.id}'는 문자열이어야 합니다.`);
      return raw;

    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) throw new Error(`필드 '${def.id}'는 숫자여야 합니다.`);
      return n;
    }

    case 'date':
      if (typeof raw !== 'string' || !DATE_RE.test(raw)) {
        throw new Error(`필드 '${def.id}'는 YYYY-MM-DD 형식이어야 합니다.`);
      }
      return raw;

    case 'person': {
      // [{ userId: string|null, name: string }]
      if (!Array.isArray(raw)) throw new Error(`필드 '${def.id}'는 담당자 배열이어야 합니다.`);
      const people = raw.map((p) => {
        if (!p || typeof p !== 'object') throw new Error(`필드 '${def.id}' 담당자 형식 오류.`);
        const userId = (p as { userId?: unknown }).userId;
        const name = (p as { name?: unknown }).name;
        if (typeof name !== 'string') throw new Error(`필드 '${def.id}' 담당자 name 누락.`);
        if (userId != null && typeof userId !== 'string') throw new Error(`필드 '${def.id}' userId 형식 오류.`);
        if (userId && orgMemberIds && !orgMemberIds.has(userId as string)) {
          throw new Error(`필드 '${def.id}' 담당자가 조직 멤버가 아닙니다.`);
        }
        return { userId: (userId as string) ?? null, name };
      });
      if (!cfg.multi && people.length > 1) throw new Error(`필드 '${def.id}'는 단일 담당자만 허용합니다.`);
      return people;
    }

    case 'dropdown':
    case 'priority': {
      const optionIds = new Set((cfg.options ?? []).map((o) => o.id));
      const check = (v: unknown) => {
        if (typeof v !== 'string' || !optionIds.has(v)) {
          throw new Error(`필드 '${def.id}'에 유효하지 않은 옵션입니다.`);
        }
        return v;
      };
      if (cfg.multi && def.type === 'dropdown') {
        if (!Array.isArray(raw)) throw new Error(`필드 '${def.id}'는 옵션 배열이어야 합니다.`);
        return raw.map(check);
      }
      return check(raw);
    }

    default:
      throw new Error(`알 수 없는 필드 타입: ${def.type}`);
  }
}
