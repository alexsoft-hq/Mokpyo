import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_COMMANDS, NEW_GOAL_PATH, SEQUENCE_TIMEOUT_MS } from '@/lib/shortcuts';

/** 글자를 입력 중인 곳에서는 단축키를 잡지 않는다. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return target.isContentEditable;
}

/** 모달·다이얼로그가 떠 있으면 뒤쪽 화면 단축키는 동작하지 않는다. */
function isDialogOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
  );
}

export interface KeyboardShortcutOptions {
  /** 비로그인 등으로 단축키를 꺼야 할 때 false */
  enabled?: boolean;
  paletteOpen: boolean;
  onPaletteOpenChange: (open: boolean) => void;
  onOpenHelp: () => void;
}

/**
 * 전역 단축키. GlobalShortcuts 한 곳에서만 호출한다.
 * - Cmd/Ctrl+K: 명령 팔레트 토글
 * - g 다음 c/t/b/l/d: 카드/테이블/보드/타임라인/대시보드
 * - n: 새 목표, ?: 단축키 도움말
 */
export function useKeyboardShortcuts(options: KeyboardShortcutOptions) {
  const navigate = useNavigate();
  // 최신 옵션을 리스너에서 읽되, 리스너 자체는 다시 붙이지 않는다.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const pendingSequenceAt = useRef(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const opts = optionsRef.current;
      if (opts.enabled === false) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === 'k') {
        event.preventDefault();
        if (opts.paletteOpen) {
          opts.onPaletteOpenChange(false);
          return;
        }
        // 다른 모달 위에 팔레트를 겹쳐 띄우지 않는다.
        if (isDialogOpen()) return;
        opts.onPaletteOpenChange(true);
        return;
      }

      if (mod || event.altKey) return;
      if (opts.paletteOpen || isDialogOpen()) return;
      if (isTypingTarget(event.target)) return;

      // g 다음 키 — 시퀀스 소비
      const sequenceActive =
        pendingSequenceAt.current > 0 &&
        Date.now() - pendingSequenceAt.current < SEQUENCE_TIMEOUT_MS;
      if (sequenceActive) {
        pendingSequenceAt.current = 0;
        const target = NAV_COMMANDS.find((c) => c.seqKey === key);
        if (target) {
          event.preventDefault();
          navigate(target.path);
        }
        return;
      }
      pendingSequenceAt.current = 0;

      if (event.key === '?') {
        event.preventDefault();
        opts.onOpenHelp();
        return;
      }

      if (event.shiftKey) return;

      if (key === 'g') {
        pendingSequenceAt.current = Date.now();
        return;
      }

      if (key === 'n') {
        event.preventDefault();
        navigate(NEW_GOAL_PATH);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
