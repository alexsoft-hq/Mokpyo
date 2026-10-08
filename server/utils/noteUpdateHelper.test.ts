import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildNoteUpdateData } from './noteUpdateHelper';

describe('buildNoteUpdateData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should include updatedAt when content changes', () => {
    const existing = { content: '기존 내용', isPinned: false };
    const incoming = { content: '새 내용', isPinned: false };

    const result = buildNoteUpdateData(existing, incoming);

    expect(result.shouldUpdate).toBe(true);
    expect(result.data.updatedAt).toEqual(new Date('2025-01-15T12:00:00Z'));
    expect(result.data.content).toBe('새 내용');
    expect(result.data.version).toEqual({ increment: 1 });
  });

  it('should NOT include updatedAt when only isPinned changes', () => {
    const existing = { content: '내용', isPinned: false };
    const incoming = { content: '내용', isPinned: true };

    const result = buildNoteUpdateData(existing, incoming);

    expect(result.shouldUpdate).toBe(true);
    expect(result.data).not.toHaveProperty('updatedAt');
    expect(result.data.isPinned).toBe(true);
  });

  it('should include updatedAt when both content and isPinned change', () => {
    const existing = { content: '기존 내용', isPinned: false };
    const incoming = { content: '새 내용', isPinned: true };

    const result = buildNoteUpdateData(existing, incoming);

    expect(result.shouldUpdate).toBe(true);
    expect(result.data.updatedAt).toEqual(new Date('2025-01-15T12:00:00Z'));
    expect(result.data.content).toBe('새 내용');
    expect(result.data.isPinned).toBe(true);
  });

  it('should return shouldUpdate false when nothing changes', () => {
    const existing = { content: '내용', isPinned: false };
    const incoming = { content: '내용', isPinned: false };

    const result = buildNoteUpdateData(existing, incoming);

    expect(result.shouldUpdate).toBe(false);
    expect(result.data).toEqual({});
  });

  it('should NOT include updatedAt when unpinning', () => {
    const existing = { content: '내용', isPinned: true };
    const incoming = { content: '내용', isPinned: false };

    const result = buildNoteUpdateData(existing, incoming);

    expect(result.shouldUpdate).toBe(true);
    expect(result.data).not.toHaveProperty('updatedAt');
    expect(result.data.isPinned).toBe(false);
  });
});
