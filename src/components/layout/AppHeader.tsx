import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { t, useTranslation } from '@/i18n';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { ProjectSelector } from '@/components/ProjectSelector';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { NotificationBell } from '@/components/NotificationBell';
import { UserMenu } from '@/components/UserMenu';
import { MobileWorkspaceItems } from '@/components/MobileWorkspaceItems';
import { QuickNavMenu } from '@/components/QuickNavMenu';
import { ViewTabs } from '@/components/layout/ViewTabs';
import { SettingsDialog } from '@/components/SettingsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  /** 좌측 h1 제목(서브페이지·자동화). 없으면 표시 안 함. */
  title?: string;
  /** 제목 아래 부제(예: 프로젝트명·인원수). */
  subtitle?: string;
  /** 뒤로가기 화살표 대상 경로(서브페이지). */
  backTo?: string;
  /** 좌측에 ProjectSelector 표시(기본 true). 프로젝트 스코프 페이지용. */
  showProjectSelector?: boolean;
  /** 하단에 뷰 전환 탭 표시(5개 보드뷰만 true). */
  showTabs?: boolean;
  /** 뷰별 헤더 액션(상태 추가/규칙 추가/하위 포함 토글/새 목표 등). 크롬 왼쪽에 배치. */
  actions?: React.ReactNode;
}

/**
 * 전 페이지 공통 상단 크롬(Tier-1). 우측 묶음(바로가기·알림·워크스페이스·계정)은 항상 동일 순서·위치.
 * 뷰별 컨트롤은 actions 슬롯 또는 각 페이지가 이 아래에 두는 전용 툴바(Tier-2)로.
 */
export function AppHeader({ title, subtitle, backTo, showProjectSelector = true, showTabs = false, actions }: AppHeaderProps) {
  useTranslation();
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const { settings, updateSettings } = useUserSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="border-b bg-card sticky top-0 z-30">
      <div className="px-3 md:px-6 min-h-14 py-2 flex flex-wrap sm:flex-nowrap items-center gap-2 md:gap-3">
        {backTo && (
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(backTo)} aria-label={t("뒤로")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Link to="/" aria-label={t("Mokpyo 홈")} className="shrink-0"><LogoMark size={22} /></Link>
        {showProjectSelector && <div className="min-w-0 flex-1 sm:flex-initial"><ProjectSelector /></div>}
        {title && (
          <div className="min-w-0 flex-1 sm:flex-initial">
            <h1 className="text-lg font-bold leading-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
        )}

        <div className="hidden sm:block flex-1" />

        {actions && (
          <div className="order-last flex w-full flex-wrap items-center gap-2 pt-1 sm:order-none sm:w-auto sm:flex-nowrap sm:pt-0">
            {actions}
            <div className="hidden sm:block mx-0.5 h-7 w-px self-center bg-border" aria-hidden />
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 md:gap-2 shrink-0">
          <LanguageSwitcher />
          <QuickNavMenu />
          <NotificationBell />
          {/* 워크스페이스 전환: 데스크톱은 헤더, 모바일은 계정 메뉴 안(MobileWorkspaceItems) */}
          <div className="hidden sm:block"><WorkspaceSelector /></div>
          {user && (
            <UserMenu
              user={user}
              onLogout={logout}
              onUserUpdate={updateUser}
              onSettingsClick={() => setSettingsOpen(true)}
              extraItems={<MobileWorkspaceItems />}
            />
          )}
        </div>
      </div>

      {showTabs && (
        <div className={cn('px-2 md:px-4')}>
          <ViewTabs />
        </div>
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaveUser={updateSettings}
        userSettings={settings}
      />
    </div>
  );
}
