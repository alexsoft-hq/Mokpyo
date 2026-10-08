import { ChevronDown } from 'lucide-react';

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Accordion 프리미티브가 없어 details/summary 로 만든 FAQ.
 * 키보드 조작·스크린 리더 동작은 브라우저 기본 구현을 그대로 쓴다.
 */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-foreground marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

export default FaqList;
