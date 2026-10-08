// 댓글 본문의 @[이름](userId) 마커에서 멘션된 userId 를 추출한다.
// 프론트(src/lib/mentions.ts)와 동일한 마커 규약.
const MENTION_RE = /@\[[^\]]+\]\(([^)]+)\)/g;

export function parseMentionUserIds(body: string): string[] {
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(body)) !== null) {
    if (m[1]) ids.add(m[1]);
  }
  return [...ids];
}
