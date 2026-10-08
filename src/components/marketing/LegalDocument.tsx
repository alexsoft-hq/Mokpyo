import { AlertTriangle } from 'lucide-react';

interface LegalDocumentProps {
  title: string;
  /** 설치 운영자의 약관과 구분하기 위한 안내. */
  notice: string;
  children: React.ReactNode;
}

/**
 * 이용약관·개인정보처리방침 공통 문서 레이아웃.
 * prose 플러그인이 없어 본문 서식은 하위 컴포넌트가 직접 클래스로 준다.
 */
export function LegalDocument({ title, notice, children }: LegalDocumentProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 md:px-6 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>

      <div
        role="note"
        className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-card p-4"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-foreground">
          {notice}
        </p>
      </div>

      <div className="mt-10 space-y-10">{children}</div>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
