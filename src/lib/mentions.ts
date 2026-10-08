// 댓글 멘션 마커 규약: @[이름](userId). 서버(server/lib/mentions.ts)와 동일.

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

export interface MentionSegment {
  type: 'text' | 'mention';
  value: string;    // text: 원문 / mention: 표시 이름
  userId?: string;
}

/** 본문을 텍스트/멘션 세그먼트로 분해(렌더용). */
export function parseMentionSegments(body: string): MentionSegment[] {
  const segs: MentionSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE);
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) segs.push({ type: 'text', value: body.slice(last, m.index) });
    segs.push({ type: 'mention', value: m[1], userId: m[2] });
    last = m.index + m[0].length;
  }
  if (last < body.length) segs.push({ type: 'text', value: body.slice(last) });
  return segs;
}

/** 본문에서 멘션된 userId 목록. */
export function parseMentionUserIds(body: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(MENTION_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) ids.add(m[2]);
  return [...ids];
}

/** 이름+userId 를 마커로 직렬화. */
export function toMentionMarker(name: string, userId: string): string {
  return `@[${name}](${userId})`;
}
