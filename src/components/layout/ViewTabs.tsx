import { t, useTranslation } from '@/i18n';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Table2, KanbanSquare, GanttChart, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

// 뷰 탭. 미구현 라우트는 비활성으로 노출하지 않는다(dead link 방지) — 각 Phase 에서 enabled 전환.
interface TabDef {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

const TABS: TabDef[] = [
  { to: '/', get label() { return t("카드"); }, icon: LayoutGrid, enabled: true },
  { to: '/table', get label() { return t("테이블"); }, icon: Table2, enabled: true },
  { to: '/board', get label() { return t("보드"); }, icon: KanbanSquare, enabled: true },
  { to: '/timeline', get label() { return t("타임라인"); }, icon: GanttChart, enabled: true },
  { to: '/dashboard', get label() { return t("대시보드"); }, icon: BarChart3, enabled: true },
];

export function ViewTabs({ className }: { className?: string }) {
  useTranslation();
  return (
    <div className={cn('flex items-center gap-1 border-b overflow-x-auto overflow-y-hidden', className)}>
      {TABS.filter((t) => t.enabled).map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          title={t.label}
          aria-label={t.label}
          className={({ isActive }) =>
            cn(
              'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors flex-1 sm:flex-none',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )
          }
        >
          <t.icon className="h-4 w-4" />
          <span className="hidden sm:inline">{t.label}</span>
        </NavLink>
      ))}
    </div>
  );
}
