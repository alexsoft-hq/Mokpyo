import { ThemeProvider } from '@/contexts/ThemeContext';
import { useUserSettings } from '@/hooks/useUserSettings';

/**
 * 앱 전역 테마 적용. 기존엔 Index(카드뷰)에서만 ThemeProvider 를 감싸서, /table 등으로
 * 직접 진입하면 테마가 적용되지 않는 갭이 있었다. App.tsx 라우트 상위에 한 번 배치해
 * 모든 페이지에서 테마가 일관 적용되도록 한다. useUserSettings 는 localStorage 기반(무의존).
 */
export function ThemeApplier({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useUserSettings();
  return (
    <ThemeProvider theme={settings.theme} onThemeChange={(theme) => updateSettings({ theme })}>
      {children}
    </ThemeProvider>
  );
}
