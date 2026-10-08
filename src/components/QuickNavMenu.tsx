import { t, useTranslation } from '@/i18n';
import { Link } from 'react-router-dom';
import { MoreHorizontal, History, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface QuickNavMenuProps {
  /** Trigger button size — 'default' for OverallSummary, 'sm' for the compact header. */
  size?: 'default' | 'sm';
}

/**
 * "바로가기" 오버플로우 메뉴 — 목표 뷰(탭)가 아닌 2차 목적지 전용.
 * - 담당자별 현황: 대시보드의 담당자 위젯에서 드릴다운으로 접근(이 메뉴에서 제거).
 * - 설정: 개인 설정이라 계정 메뉴(UserMenu)로 이동(이 메뉴에서 제거).
 */
export function QuickNavMenu({ size = 'default' }: QuickNavMenuProps) {
  useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant="outline" className="shadow-md" aria-label={t("바로가기")}>
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("바로가기")}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/activity" className="flex items-center gap-2 cursor-pointer">
            <History className="w-4 h-4" />
            {t("활동 내역")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/report" className="flex items-center gap-2 cursor-pointer">
            <Sparkles className="w-4 h-4" />
            {t("AI 리포트")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/automations" className="flex items-center gap-2 cursor-pointer">
            <Zap className="w-4 h-4" />
            {t("자동화")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
