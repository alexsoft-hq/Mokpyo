import { cn } from '@/lib/utils';
import { readableTextColor } from '@/lib/colorUtils';
import { StatusLabel } from '@/types/fields';

interface StatusPillProps {
  label?: Pick<StatusLabel, 'name' | 'color'> | null;
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
  emptyText?: string;
}

/**
 * 상태 라벨을 채워진 알약으로 렌더. 테이블 셀·보드 컬럼 헤더·카드·위젯 범례·패널 헤더 공용 프리미티브.
 * 글자색은 배경 명도로 자동 결정(흰색 고정 금지 — 밝은 라벨 판독성).
 * label 이 없으면 '상태 없음' 중립 표시(NULL statusId 방어).
 */
export function StatusPill({ label, size = 'md', className, onClick, emptyText = '상태 없음' }: StatusPillProps) {
  const isEmpty = !label;
  const bg = label?.color ?? '#e5e7eb';
  const style = isEmpty ? undefined : { backgroundColor: bg, color: readableTextColor(bg) };
  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap max-w-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        isEmpty && 'bg-muted text-muted-foreground',
        onClick && 'cursor-pointer hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      style={style}
      title={isEmpty ? undefined : label!.name}
    >
      <span className="truncate">{isEmpty ? emptyText : label!.name}</span>
    </span>
  );
}

/**
 * dropdown/priority 옵션·라벨용 공용 칩. 색이 없으면 토큰(bg-muted)으로 폴백(다크모드 안전),
 * 긴 라벨은 truncate + title. StatusPill 과 같은 대비 규칙을 공유.
 */
export function OptionChip({ label, color, className }: { label: string; color?: string; className?: string }) {
  const hasColor = !!color;
  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium max-w-[140px]',
        !hasColor && 'bg-muted text-muted-foreground',
        className
      )}
      style={hasColor ? { backgroundColor: color, color: readableTextColor(color!) } : undefined}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
