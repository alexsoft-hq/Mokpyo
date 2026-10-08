import { describe, it, expect } from 'vitest';
import { validateAndMergeFieldValues, FieldDef } from './customFieldValues';

const defs: FieldDef[] = [
  { id: 'f_text', type: 'text', config: {} },
  { id: 'f_num', type: 'number', config: { unit: '원' } },
  { id: 'f_date', type: 'date', config: {} },
  { id: 'f_person', type: 'person', config: { multi: true } },
  { id: 'f_person1', type: 'person', config: {} },
  { id: 'f_drop', type: 'dropdown', config: { options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }] } },
  { id: 'f_dropmulti', type: 'dropdown', config: { multi: true, options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }] } },
  { id: 'f_pri', type: 'priority', config: { options: [{ id: 'p_high', label: '높음' }] } },
];

describe('validateAndMergeFieldValues', () => {
  it('알 수 없는 defId 는 무시(정의 삭제 대비)', () => {
    const out = validateAndMergeFieldValues(defs, {}, { unknown_field: 'x', f_text: 'ok' });
    expect(out).toEqual({ f_text: 'ok' });
  });

  it('null 값은 키 삭제', () => {
    const out = validateAndMergeFieldValues(defs, { f_text: 'old', f_num: 5 }, { f_text: null });
    expect(out).toEqual({ f_num: 5 });
  });

  it('number 는 숫자로 강제, 비수치는 거부', () => {
    expect(validateAndMergeFieldValues(defs, {}, { f_num: '42' })).toEqual({ f_num: 42 });
    expect(() => validateAndMergeFieldValues(defs, {}, { f_num: 'abc' })).toThrow();
  });

  it('date 는 YYYY-MM-DD 만 허용', () => {
    expect(validateAndMergeFieldValues(defs, {}, { f_date: '2026-07-06' })).toEqual({ f_date: '2026-07-06' });
    expect(() => validateAndMergeFieldValues(defs, {}, { f_date: '2026/07/06' })).toThrow();
  });

  it('person: 조직 멤버 검증 + 단일 필드는 1명 초과 거부', () => {
    const members = new Set(['u1', 'u2']);
    const ok = validateAndMergeFieldValues(defs, {}, { f_person: [{ userId: 'u1', name: '갑' }, { userId: 'u2', name: '을' }] }, members);
    expect((ok.f_person as any[]).length).toBe(2);
    // 비멤버 거부
    expect(() => validateAndMergeFieldValues(defs, {}, { f_person: [{ userId: 'ghost', name: '유령' }] }, members)).toThrow();
    // 단일 person 필드에 2명 → 거부
    expect(() => validateAndMergeFieldValues(defs, {}, { f_person1: [{ userId: 'u1', name: '갑' }, { userId: 'u2', name: '을' }] }, members)).toThrow();
    // userId null 은 허용(미링크 담당자)
    expect(validateAndMergeFieldValues(defs, {}, { f_person1: [{ userId: null, name: '외부' }] }, members).f_person1).toEqual([{ userId: null, name: '외부' }]);
  });

  it('dropdown/priority: 정의된 옵션만 허용', () => {
    expect(validateAndMergeFieldValues(defs, {}, { f_drop: 'o1' })).toEqual({ f_drop: 'o1' });
    expect(() => validateAndMergeFieldValues(defs, {}, { f_drop: 'nope' })).toThrow();
    expect(validateAndMergeFieldValues(defs, {}, { f_pri: 'p_high' })).toEqual({ f_pri: 'p_high' });
  });

  it('dropdown multi: 옵션 id 배열', () => {
    expect(validateAndMergeFieldValues(defs, {}, { f_dropmulti: ['o1', 'o2'] })).toEqual({ f_dropmulti: ['o1', 'o2'] });
    expect(() => validateAndMergeFieldValues(defs, {}, { f_dropmulti: ['o1', 'bad'] })).toThrow();
  });

  it('기존 값 위에 병합(다른 키 보존)', () => {
    const out = validateAndMergeFieldValues(defs, { f_text: 'keep', f_num: 1 }, { f_num: 2 });
    expect(out).toEqual({ f_text: 'keep', f_num: 2 });
  });
});
