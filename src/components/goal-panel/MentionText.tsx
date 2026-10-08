import { parseMentionSegments } from '@/lib/mentions';
import { LinkifiedText } from '@/components/LinkifiedText';

/** 댓글 본문 렌더: @[이름](id) 는 강조 칩, 그 외 텍스트는 URL 자동 링크(LinkifiedText). */
export function MentionText({ body }: { body: string }) {
  const segments = parseMentionSegments(body);
  return (
    <span className="whitespace-pre-wrap break-words">
      {segments.map((s, i) =>
        s.type === 'mention' ? (
          <span key={i} className="inline-flex items-center rounded bg-primary/10 text-primary px-1 font-medium">
            @{s.value}
          </span>
        ) : (
          <LinkifiedText key={i} text={s.value} />
        )
      )}
    </span>
  );
}
