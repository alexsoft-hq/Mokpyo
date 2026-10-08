import { GoalSnapshot, RuleLike } from './types';

interface Cond {
  attr: string; // 'statusId' | 'size' | 'categoryId' | 'field:<id>'
  op: 'eq' | 'neq' | 'in';
  value: unknown;
}

/** 규칙 조건(AND)을 스냅샷에 대해 평가(순수 함수). 조건 없으면 항상 통과. */
export function passesConditions(rule: RuleLike, goal: GoalSnapshot): boolean {
  const conds: Cond[] = Array.isArray(rule.condition) ? rule.condition : [];
  if (conds.length === 0) return true;
  return conds.every((c) => evalCond(c, goal));
}

function resolveAttr(attr: string, goal: GoalSnapshot): unknown {
  if (attr === 'statusId') return goal.statusId;
  if (attr === 'size') return goal.size;
  if (attr === 'categoryId') return goal.categoryIds; // 배열 — in/eq(포함) 처리
  if (attr.startsWith('field:')) return goal.customFields?.[attr.slice(6)];
  return undefined;
}

function evalCond(c: Cond, goal: GoalSnapshot): boolean {
  const actual = resolveAttr(c.attr, goal);
  switch (c.op) {
    case 'eq':
      return Array.isArray(actual) ? actual.includes(c.value as any) : actual === c.value;
    case 'neq':
      return Array.isArray(actual) ? !actual.includes(c.value as any) : actual !== c.value;
    case 'in': {
      const set = Array.isArray(c.value) ? c.value : [c.value];
      return Array.isArray(actual) ? actual.some((a) => set.includes(a)) : set.includes(actual);
    }
    default:
      return false;
  }
}
