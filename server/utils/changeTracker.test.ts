import { describe, it, expect } from 'vitest';
import {
  detectGoalChanges,
  detectCategoryChanges,
  detectSubGoalChanges,
  detectNoteChanges,
  buildChangesData,
} from './changeTracker';

describe('changeTracker', () => {
  describe('detectGoalChanges', () => {
    it('should detect title change', () => {
      const current = { title: '기존 제목' };
      const newData = { title: '새 제목' };

      const changes = detectGoalChanges(current, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        field: 'title',
        fieldLabel: '제목',
        oldValue: '기존 제목',
        newValue: '새 제목',
        type: 'primitive',
      });
    });

    it('should detect progress change with % suffix', () => {
      const current = { progress: 30 };
      const newData = { progress: 50 };

      const changes = detectGoalChanges(current, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0].oldValue).toBe('30%');
      expect(changes[0].newValue).toBe('50%');
    });

    it('should detect size change with Korean labels', () => {
      const current = { size: 'small' };
      const newData = { size: 'large' };

      const changes = detectGoalChanges(current, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0].oldValue).toBe('낮음');
      expect(changes[0].newValue).toBe('높음');
    });

    it('should detect date change with formatted display', () => {
      const current = { startDate: '2024-01-15' };
      const newData = { startDate: '2024-02-20' };

      const changes = detectGoalChanges(current, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0].oldValue).toBe('2024년 1월 15일');
      expect(changes[0].newValue).toBe('2024년 2월 20일');
    });

    it('should not detect changes when values are same', () => {
      const current = { title: '동일 제목', progress: 50 };
      const newData = { title: '동일 제목', progress: 50 };

      const changes = detectGoalChanges(current, newData);

      expect(changes).toHaveLength(0);
    });

    it('should skip fields not in newData', () => {
      const current = { title: '기존', progress: 30, description: '설명' };
      const newData = { title: '새 제목' }; // progress, description not included

      const changes = detectGoalChanges(current, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe('title');
    });

    it('should truncate long description text', () => {
      const longText = 'A'.repeat(200);
      const current = { description: 'short' };
      const newData = { description: longText };

      const changes = detectGoalChanges(current, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0].newValue.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(changes[0].newValue.endsWith('...')).toBe(true);
    });

    it('should handle null to value change', () => {
      const current = { owner: null };
      const newData = { owner: '담당자' };

      const changes = detectGoalChanges(current, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0].oldValue).toBe('없음');
      expect(changes[0].newValue).toBe('담당자');
    });

    it('should handle date comparison with different formats', () => {
      const current = { startDate: new Date('2024-01-15') };
      const newData = { startDate: '2024-01-15T00:00:00.000Z' };

      const changes = detectGoalChanges(current, newData);

      // Same date, different format - should not detect change
      expect(changes).toHaveLength(0);
    });

    it('should detect multiple field changes', () => {
      const current = { title: '기존', progress: 0, owner: '홍길동' };
      const newData = { title: '새 제목', progress: 100, owner: '김철수' };

      const changes = detectGoalChanges(current, newData);

      expect(changes).toHaveLength(3);
      expect(changes.map(c => c.field)).toEqual(['title', 'progress', 'owner']);
    });
  });

  describe('detectCategoryChanges', () => {
    it('should detect added categories', () => {
      const oldCategories = ['개발'];
      const newCategories = ['개발', '디자인'];

      const changes = detectCategoryChanges(oldCategories, newCategories);

      expect(changes).toEqual({
        added: ['디자인'],
      });
    });

    it('should detect removed categories', () => {
      const oldCategories = ['개발', '디자인'];
      const newCategories = ['개발'];

      const changes = detectCategoryChanges(oldCategories, newCategories);

      expect(changes).toEqual({
        removed: ['디자인'],
      });
    });

    it('should detect both added and removed categories', () => {
      const oldCategories = ['개발', '디자인'];
      const newCategories = ['개발', '마케팅'];

      const changes = detectCategoryChanges(oldCategories, newCategories);

      expect(changes).toEqual({
        added: ['마케팅'],
        removed: ['디자인'],
      });
    });

    it('should return null when no changes', () => {
      const oldCategories = ['개발', '디자인'];
      const newCategories = ['디자인', '개발']; // Same, different order

      const changes = detectCategoryChanges(oldCategories, newCategories);

      expect(changes).toBeNull();
    });

    it('should handle empty arrays', () => {
      const changes1 = detectCategoryChanges([], ['개발']);
      expect(changes1).toEqual({ added: ['개발'] });

      const changes2 = detectCategoryChanges(['개발'], []);
      expect(changes2).toEqual({ removed: ['개발'] });

      const changes3 = detectCategoryChanges([], []);
      expect(changes3).toBeNull();
    });
  });

  describe('detectSubGoalChanges', () => {
    it('should detect added sub-goals', () => {
      const current = [{ id: '1', title: '기존', progress: 0 }];
      const newSubs = [
        { id: '1', title: '기존', progress: 0 },
        { title: '새 하위목표', progress: 0 }, // No id = new
      ];

      const changes = detectSubGoalChanges(current, newSubs);

      expect(changes?.added).toHaveLength(1);
      expect(changes?.added?.[0].title).toBe('새 하위목표');
    });

    it('should detect deleted sub-goals', () => {
      const current = [
        { id: '1', title: '유지', progress: 0 },
        { id: '2', title: '삭제됨', progress: 50 },
      ];
      const newSubs = [{ id: '1', title: '유지', progress: 0 }];

      const changes = detectSubGoalChanges(current, newSubs);

      expect(changes?.deleted).toHaveLength(1);
      expect(changes?.deleted?.[0]).toEqual({ id: '2', title: '삭제됨' });
    });

    it('should detect updated sub-goals with title change', () => {
      const current = [{ id: '1', title: '기존 제목', progress: 0 }];
      const newSubs = [{ id: '1', title: '변경된 제목', progress: 0 }];

      const changes = detectSubGoalChanges(current, newSubs);

      expect(changes?.updated).toHaveLength(1);
      expect(changes?.updated?.[0].changes).toContainEqual({
        field: 'title',
        fieldLabel: '제목',
        oldValue: '기존 제목',
        newValue: '변경된 제목',
        type: 'primitive',
      });
    });

    it('should detect updated sub-goals with progress change', () => {
      const current = [{ id: '1', title: '목표', progress: 30 }];
      const newSubs = [{ id: '1', title: '목표', progress: 70 }];

      const changes = detectSubGoalChanges(current, newSubs);

      expect(changes?.updated).toHaveLength(1);
      expect(changes?.updated?.[0].changes[0].oldValue).toBe('30%');
      expect(changes?.updated?.[0].changes[0].newValue).toBe('70%');
    });

    it('should return null when no changes', () => {
      const current = [{ id: '1', title: '목표', progress: 50 }];
      const newSubs = [{ id: '1', title: '목표', progress: 50 }];

      const changes = detectSubGoalChanges(current, newSubs);

      expect(changes).toBeNull();
    });

    it('should return null for undefined newSubGoals', () => {
      const current = [{ id: '1', title: '목표', progress: 50 }];

      const changes = detectSubGoalChanges(current, undefined);

      expect(changes).toBeNull();
    });
  });

  describe('detectNoteChanges', () => {
    it('should detect added notes', () => {
      const current = [{ id: '1', content: '기존 메모' }];
      const newNotes = [
        { id: '1', content: '기존 메모' },
        { content: '새 메모' }, // No id = new
      ];

      const changes = detectNoteChanges(current, newNotes);

      expect(changes?.added).toHaveLength(1);
      expect(changes?.added?.[0].content).toBe('새 메모');
    });

    it('should detect deleted notes', () => {
      const current = [
        { id: '1', content: '유지 메모' },
        { id: '2', content: '삭제될 메모' },
      ];
      const newNotes = [{ id: '1', content: '유지 메모' }];

      const changes = detectNoteChanges(current, newNotes);

      expect(changes?.deleted).toHaveLength(1);
      expect(changes?.deleted?.[0].id).toBe('2');
    });

    it('should detect updated notes', () => {
      const current = [{ id: '1', content: '원래 내용' }];
      const newNotes = [{ id: '1', content: '수정된 내용' }];

      const changes = detectNoteChanges(current, newNotes);

      expect(changes?.updated).toHaveLength(1);
      expect(changes?.updated?.[0].id).toBe('1');
    });

    it('should truncate long note content in preview', () => {
      const longContent = 'B'.repeat(100);
      const current = [{ id: '1', content: 'short' }];
      const newNotes = [{ id: '1', content: longContent }];

      const changes = detectNoteChanges(current, newNotes);

      expect(changes?.updated?.[0].contentPreview.length).toBeLessThanOrEqual(33); // 30 + '...'
    });

    it('should return null when no changes', () => {
      const current = [{ id: '1', content: '동일' }];
      const newNotes = [{ id: '1', content: '동일' }];

      const changes = detectNoteChanges(current, newNotes);

      expect(changes).toBeNull();
    });

    it('should return null for undefined newNotes', () => {
      const current = [{ id: '1', content: '메모' }];

      const changes = detectNoteChanges(current, undefined);

      expect(changes).toBeNull();
    });
  });

  describe('buildChangesData', () => {
    it('should combine all types of changes', () => {
      const currentGoal = { title: '기존', progress: 0 };
      const newGoalData = { title: '새 제목', progress: 50 };
      const oldCategories = ['개발'];
      const newCategories = ['디자인'];
      const currentSubGoals = [{ id: '1', title: '하위', progress: 0 }];
      const newSubGoals = [{ id: '1', title: '변경된 하위', progress: 0 }];
      const currentNotes = [{ id: 'n1', content: '메모' }];
      const newNotes = [{ id: 'n1', content: '수정된 메모' }];

      const result = buildChangesData(
        currentGoal,
        newGoalData,
        oldCategories,
        newCategories,
        currentSubGoals,
        newSubGoals,
        currentNotes,
        newNotes
      );

      expect(result).not.toBeNull();
      expect(result?.fields).toHaveLength(2); // title, progress
      expect(result?.categories).toEqual({
        added: ['디자인'],
        removed: ['개발'],
      });
      expect(result?.subGoals?.updated).toHaveLength(1);
      expect(result?.notes?.updated).toHaveLength(1);
    });

    it('should return null when no changes at all', () => {
      const currentGoal = { title: '동일' };
      const newGoalData = { title: '동일' };

      const result = buildChangesData(
        currentGoal,
        newGoalData,
        ['개발'],
        ['개발'],
        [{ id: '1', title: '하위', progress: 50 }],
        [{ id: '1', title: '하위', progress: 50 }],
        [{ id: 'n1', content: '메모' }],
        [{ id: 'n1', content: '메모' }]
      );

      expect(result).toBeNull();
    });

    it('should only include changed sections', () => {
      const currentGoal = { title: '동일' };
      const newGoalData = { title: '동일' };

      const result = buildChangesData(
        currentGoal,
        newGoalData,
        ['개발'],
        ['개발', '디자인'], // Only categories changed
        [],
        [],
        [],
        []
      );

      expect(result).not.toBeNull();
      expect(result?.fields).toBeUndefined();
      expect(result?.categories).toEqual({ added: ['디자인'] });
      expect(result?.subGoals).toBeUndefined();
      expect(result?.notes).toBeUndefined();
    });
  });
});
