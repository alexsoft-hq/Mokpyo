import { describe, it, expect } from 'vitest';
import { parseMentionSegments, parseMentionUserIds, toMentionMarker } from './mentions';

describe('mentions', () => {
  it('마커에서 userId 추출(중복 제거)', () => {
    expect(parseMentionUserIds('@[갑](u1) 안녕 @[을](u2) @[갑](u1)')).toEqual(['u1', 'u2']);
    expect(parseMentionUserIds('멘션 없음')).toEqual([]);
  });

  it('세그먼트 분해: 텍스트/멘션 순서 보존', () => {
    const segs = parseMentionSegments('안녕 @[갑](u1) 확인바람');
    expect(segs).toEqual([
      { type: 'text', value: '안녕 ' },
      { type: 'mention', value: '갑', userId: 'u1' },
      { type: 'text', value: ' 확인바람' },
    ]);
  });

  it('연속 멘션 + 앞뒤 텍스트 없음', () => {
    const segs = parseMentionSegments('@[갑](u1)@[을](u2)');
    expect(segs).toEqual([
      { type: 'mention', value: '갑', userId: 'u1' },
      { type: 'mention', value: '을', userId: 'u2' },
    ]);
  });

  it('toMentionMarker 왕복', () => {
    const marker = toMentionMarker('홍길동', 'u9');
    expect(marker).toBe('@[홍길동](u9)');
    expect(parseMentionUserIds(marker)).toEqual(['u9']);
    expect(parseMentionSegments(marker)[0]).toEqual({ type: 'mention', value: '홍길동', userId: 'u9' });
  });
});
