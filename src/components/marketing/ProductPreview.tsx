const TABS = ['카드', '테이블', '보드', '타임라인', '대시보드'] as const;

interface PreviewCard {
  title: string;
  owners: number;
  progress: number;
  due: string;
}

const CARDS: PreviewCard[] = [
  { title: '온보딩 이탈률 절반으로 줄이기', owners: 3, progress: 72, due: '3월 31일' },
  { title: '분기 매출 12억 달성', owners: 2, progress: 45, due: '3월 31일' },
  { title: '고객 응대 평균 4시간 이내', owners: 4, progress: 88, due: '2월 28일' },
  { title: '신규 요금제 정식 출시', owners: 2, progress: 30, due: '4월 15일' },
];

/**
 * 히어로 아래 제품 미리보기. 스크린샷 이미지 없이 토큰과 div 로만 그린다.
 * 장식이므로 스크린 리더에는 노출하지 않는다.
 */
export function ProductPreview() {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl border border-border bg-card shadow-sm overflow-hidden select-none"
    >
      {/* 상단 크롬 */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-muted" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted" />
        <span className="ml-2 h-5 flex-1 max-w-[220px] rounded-md bg-muted" />
      </div>

      {/* 뷰 탭 */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-2">
        {TABS.map((tab, i) => (
          <span
            key={tab}
            className={
              i === 0
                ? 'shrink-0 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground'
                : 'shrink-0 rounded-md px-2.5 py-1 text-xs text-muted-foreground'
            }
          >
            {tab}
          </span>
        ))}
      </div>

      {/* 카드 그리드 */}
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        {CARDS.map((card) => (
          <div key={card.title} className="rounded-lg border border-border bg-background p-3">
            <p className="text-sm font-medium leading-snug text-foreground">{card.title}</p>

            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${card.progress}%` }} />
              </div>
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{card.progress}%</span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex -space-x-1.5">
                {Array.from({ length: card.owners }).map((_, i) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full border-2 border-card bg-secondary"
                    style={{ opacity: 1 - i * 0.15 }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{card.due}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProductPreview;
