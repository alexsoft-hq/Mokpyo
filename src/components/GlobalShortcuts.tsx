// 전역 단축키·명령 팔레트 마운트 지점. App.tsx 의 라우터·프로바이더 안에서 렌더된다.
import { useState } from 'react';
import { CommandPalette } from '@/components/CommandPalette';
import { ShortcutHelpDialog } from '@/components/ShortcutHelpDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAuth } from '@/contexts/AuthContext';

/** 실제 단축키 훅은 로그인 상태에서만 마운트한다(랜딩·로그인 화면에서는 아무 것도 하지 않음). */
function ShortcutsRuntime() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useKeyboardShortcuts({
    paletteOpen,
    onPaletteOpenChange: setPaletteOpen,
    onOpenHelp: () => setHelpOpen(true),
  });

  return (
    <>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <ShortcutHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

export function GlobalShortcuts() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return <ShortcutsRuntime />;
}
