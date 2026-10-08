import { GoalCategory } from '@/types/goal';
import { cn } from '@/lib/utils';

interface CategoryStatStripProps {
  /** 카테고리별 집계: { [category]: { count, totalProgress } } */
  stats: Record<string, { count: number; totalProgress: number }>;
  categoryColors?: Record<string, string>;
  selected: GoalCategory[];
  onToggle: (category: GoalCategory) => void;
  /** 칩 밀도. compact=요약보기, comfortable=상세보기 */
  density?: 'compact' | 'comfortable';
  className?: string;
}

/**
 * 카테고리별 목표 수·평균 진행률을 미니 진행바가 달린 필터 칩으로 보여주는 전체폭 스트립.
 * 헤더 툴바에서 분리해 카테고리가 충분한 가로 공간을 갖도록 한다. 칩 클릭 = 카테고리 필터 토글.
 */
export function CategoryStatStrip({
  stats,
  categoryColors,
  selected,
  onToggle,
  density = 'comfortable',
  className,
}: CategoryStatStripProps) {
  const entries = Object.entries(stats);
  if (entries.length === 0) return null;

  const isCompact = density === 'compact';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {entries.map(([category, s]) => {
        const color = categoryColors?.[category] || '#6b7280';
        const avg = s.count > 0 ? Math.round(s.totalProgress / s.count) : 0;
        const isSel = selected.includes(category as GoalCategory);
        return (
          <button
            key={category}
            type="button"
            onClick={() => onToggle(category as GoalCategory)}
            aria-pressed={isSel}
            title={`${category} · ${s.count}개 · 평균 ${avg}%`}
            className={cn(
              'group flex items-center rounded-lg border transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              isCompact ? 'gap-1.5 px-2.5 py-1' : 'gap-2 px-3 py-1.5',
              isSel ? 'shadow-sm' : 'opacity-75 hover:opacity-100 hover:shadow-sm',
            )}
            style={{
              backgroundColor: isSel ? `${color}22` : `${color}12`,
              borderColor: isSel ? `${color}99` : `${color}40`,
            }}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            {/* 색 정체성은 색점·미니바·테두리로 전달하고, 텍스트는 대비 보장 위해 테마 토큰 사용 */}
            <span
              className={cn('max-w-[10rem] truncate font-semibold text-foreground', isCompact ? 'text-xs' : 'text-sm')}
            >
              {category}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{s.count}개</span>
            <div
              className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full"
              style={{ backgroundColor: `${color}26` }}
              aria-hidden
            >
              <div className="h-full rounded-full" style={{ width: `${avg}%`, backgroundColor: color }} />
            </div>
            <span className="text-xs font-bold tabular-nums whitespace-nowrap text-foreground">
              {avg}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
