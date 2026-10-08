import { cn } from '@/lib/utils';

interface LogoProps {
  /** 마크 크기(px). 워드마크 글자 크기는 이에 비례. */
  size?: number;
  /** 워드마크("Mokpyo") 표시 여부. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * Mokpyo 브랜드 마크 — 동심원 과녁 위에 상승 화살(진행률·목표 달성).
 * 색은 currentColor 기반이라 어느 배경에서든 text-* 로 제어한다.
 */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <circle cx="16" cy="16" r="14" className="fill-primary" />
      <circle cx="16" cy="16" r="9" className="fill-primary-foreground" fillOpacity="0.18" />
      <circle cx="16" cy="16" r="4.5" className="fill-primary-foreground" />
      <path d="M16 16 L25 7" className="stroke-primary-foreground" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20.5 7 H25 V11.5" className="stroke-primary-foreground" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ size = 24, withWordmark = true, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-foreground', className)}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="font-semibold tracking-tight leading-none" style={{ fontSize: Math.round(size * 0.8) }}>
          Mokpyo
        </span>
      )}
    </span>
  );
}
