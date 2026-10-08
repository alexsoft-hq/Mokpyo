import { describe, it, expect } from 'vitest';
import { getPriorityColor, getPriorityLabel, getPriorityIconType } from './priorityColors';

describe('priorityColors', () => {
  describe('getPriorityColor', () => {
    it('should return red for xl (최고)', () => {
      expect(getPriorityColor('xl')).toBe('#ef4444');
    });

    it('should return orange for large (높음)', () => {
      expect(getPriorityColor('large')).toBe('#f97316');
    });

    it('should return yellow for medium (중간)', () => {
      expect(getPriorityColor('medium')).toBe('#eab308');
    });

    it('should return blue for small (낮음)', () => {
      expect(getPriorityColor('small')).toBe('#3b82f6');
    });

    it('should return gray for xs (최저)', () => {
      expect(getPriorityColor('xs')).toBe('#9ca3af');
    });
  });

  describe('getPriorityLabel', () => {
    it('should return correct labels', () => {
      expect(getPriorityLabel('xl')).toBe('최고');
      expect(getPriorityLabel('large')).toBe('높음');
      expect(getPriorityLabel('medium')).toBe('중간');
      expect(getPriorityLabel('small')).toBe('낮음');
      expect(getPriorityLabel('xs')).toBe('최저');
    });
  });

  describe('getPriorityIconType', () => {
    it('should return correct icon types', () => {
      expect(getPriorityIconType('xl')).toBe('chevronsUp');
      expect(getPriorityIconType('large')).toBe('chevronUp');
      expect(getPriorityIconType('medium')).toBe('minus');
      expect(getPriorityIconType('small')).toBe('chevronDown');
      expect(getPriorityIconType('xs')).toBe('chevronsDown');
    });
  });
});
