import { describe, it, expect } from 'vitest';
import {
  CSV_BOM,
  csvFileName,
  escapeCsvCell,
  formatCustomFieldValue,
  goalsToCsv,
} from './exportCsv';
import { Goal } from '@/types/goal';
import { CustomFieldDefinition, StatusLabel } from '@/types/fields';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: '목표 1',
    owner: '김철수',
    owners: ['김철수'],
    categories: ['SERVICE'],
    progress: 40,
    size: 'medium',
    ...overrides,
  };
}

const statusLabels: StatusLabel[] = [
  {
    id: 's-progress',
    organizationId: 'org1',
    name: '진행 중',
    color: '#3b82f6',
    kind: 'active',
    order: 1,
    isSystem: true,
  },
];

describe('escapeCsvCell', () => {
  it('평범한 값은 그대로 둔다', () => {
    expect(escapeCsvCell('김철수')).toBe('김철수');
  });

  it('쉼표가 있으면 큰따옴표로 감싼다', () => {
    expect(escapeCsvCell('가, 나')).toBe('"가, 나"');
  });

  it('큰따옴표는 두 번 쓰고 전체를 감싼다', () => {
    expect(escapeCsvCell('그는 "목표"라고 했다')).toBe('"그는 ""목표""라고 했다"');
  });

  it('줄바꿈이 있으면 감싼다', () => {
    expect(escapeCsvCell('첫 줄\n둘째 줄')).toBe('"첫 줄\n둘째 줄"');
  });

  it('앞뒤 공백이 있으면 감싼다', () => {
    expect(escapeCsvCell(' 여백 ')).toBe('" 여백 "');
  });

  it('빈 값은 빈 칸으로 둔다', () => {
    expect(escapeCsvCell('')).toBe('');
  });
});

describe('goalsToCsv', () => {
  it('BOM 으로 시작하고 헤더가 붙는다', () => {
    const csv = goalsToCsv([]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.slice(CSV_BOM.length)).toBe(
      '제목,상태,담당자,진행률,중요도,시작일,마감일,분류,사이클'
    );
  });

  it('줄은 CRLF 로 구분한다', () => {
    const csv = goalsToCsv([makeGoal()]);
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  it('담당자·분류는 세미콜론으로 잇고 상태·사이클은 이름으로 바꾼다', () => {
    const csv = goalsToCsv(
      [
        makeGoal({
          owners: ['김철수', '이영희'],
          categories: ['SERVICE', 'AI'],
          statusId: 's-progress',
          cycleId: 'c1',
          startDate: '2026-01-05',
          dueDate: '2026-03-31T00:00:00.000Z',
        }),
      ],
      { statusLabels, cycles: [{ id: 'c1', name: '2026 Q1' }] }
    );
    const row = csv.split('\r\n')[1];
    expect(row).toBe('목표 1,진행 중,김철수;이영희,40,중간,2026-01-05,2026-03-31,SERVICE;AI,2026 Q1');
  });

  it('빈 값은 빈 칸으로 남고 알 수 없는 상태·사이클은 비운다', () => {
    const csv = goalsToCsv([
      makeGoal({ owners: [], owner: '', categories: [], cycleId: 'unknown' }),
    ]);
    const row = csv.split('\r\n')[1];
    expect(row).toBe('목표 1,,,40,중간,,,,');
  });

  it('제목에 쉼표·따옴표가 있어도 열이 밀리지 않는다', () => {
    const csv = goalsToCsv([makeGoal({ title: '목표 "A", 2단계', owners: [], owner: '', categories: [] })]);
    const row = csv.split('\r\n')[1];
    expect(row.startsWith('"목표 ""A"", 2단계",')).toBe(true);
    // 따옴표 밖에서 세어야 할 구분자 수는 열 수 - 1 = 8
    expect(row.slice('"목표 ""A"", 2단계"'.length).split(',').length - 1).toBe(8);
  });

  it('커스텀 필드는 정의 순서대로 열이 추가된다', () => {
    const fieldDefs: CustomFieldDefinition[] = [
      {
        id: 'f-risk',
        projectId: 'p1',
        name: '위험도',
        type: 'dropdown',
        config: { options: [{ id: 'o1', label: '높음' }, { id: 'o2', label: '낮음' }] },
        order: 0,
      },
      { id: 'f-budget', projectId: 'p1', name: '예산', type: 'number', config: { unit: '만원' }, order: 1 },
    ];
    const csv = goalsToCsv(
      [makeGoal({ owners: [], owner: '', categories: [], customFields: { 'f-risk': 'o1', 'f-budget': 300 } })],
      { fieldDefs }
    );
    const [header, row] = csv.split('\r\n');
    expect(header.endsWith(',위험도,예산')).toBe(true);
    expect(row.endsWith(',높음,300 만원')).toBe(true);
  });

  it('값이 없는 커스텀 필드는 빈 칸이다', () => {
    const fieldDefs: CustomFieldDefinition[] = [
      { id: 'f-note', projectId: 'p1', name: '비고', type: 'text', config: {}, order: 0 },
    ];
    const csv = goalsToCsv([makeGoal({ owners: [], owner: '', categories: [] })], { fieldDefs });
    expect(csv.split('\r\n')[1].endsWith(',')).toBe(true);
  });
});

describe('formatCustomFieldValue', () => {
  const personDef: CustomFieldDefinition = {
    id: 'f-person',
    projectId: 'p1',
    name: '검토자',
    type: 'person',
    config: {},
    order: 0,
  };

  it('person 값은 이름만 뽑아 세미콜론으로 잇는다', () => {
    expect(
      formatCustomFieldValue(personDef, [
        { userId: 'u1', name: '김철수' },
        { userId: null, name: '이영희' },
      ])
    ).toBe('김철수;이영희');
  });

  it('null 은 빈 문자열', () => {
    expect(formatCustomFieldValue(personDef, null)).toBe('');
  });
});

describe('csvFileName', () => {
  it('프로젝트명과 날짜로 파일명을 만든다', () => {
    expect(csvFileName('2026 로드맵', new Date(2026, 8, 7))).toBe('mokpyo-2026-로드맵-20260907.csv');
  });

  it('프로젝트명이 없으면 기본값을 쓴다', () => {
    expect(csvFileName(undefined, new Date(2026, 0, 1))).toBe('mokpyo-목표-20260101.csv');
  });
});
