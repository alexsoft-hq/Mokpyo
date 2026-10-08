import { cn } from '@/lib/utils';

interface SectionProps {
  id?: string;
  /** 배경을 한 톤 눌러 섹션 경계를 만든다. */
  muted?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Section({ id, muted, className, children }: SectionProps) {
  return (
    <section
      id={id}
      className={cn('scroll-mt-16 py-16 md:py-24', muted && 'bg-card border-y border-border', className)}
    >
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">{children}</div>
    </section>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, className }: SectionHeadingProps) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow && <p className="text-sm font-medium text-primary">{eyebrow}</p>}
      <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
      {description && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
