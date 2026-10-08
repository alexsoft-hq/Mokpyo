// 단축키·명령 팔레트의 단일 정의처.
// CommandPalette(팔레트 목록), useKeyboardShortcuts(실제 키 처리),
// ShortcutHelpDialog(도움말)가 모두 이 파일을 참조한다 — 세 곳이 어긋나지 않게.

import {
  LayoutGrid,
  Table2,
  Kanban,
  GanttChart,
  LayoutDashboard,
  Users,
  History,
  Sparkles,
  Zap,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavCommand {
  id: string;
  /** 앱 안에서 쓰는 이름과 동일하게 */
  label: string;
  path: string;
  icon: LucideIcon;
  /** 'g' 를 누른 뒤 이 키를 누르면 바로 이동. 없으면 팔레트로만 이동 */
  seqKey?: string;
}

export const NAV_COMMANDS: NavCommand[] = [
  { id: 'cards', label: '카드', path: '/', icon: LayoutGrid, seqKey: 'c' },
  { id: 'table', label: '테이블', path: '/table', icon: Table2, seqKey: 't' },
  { id: 'board', label: '보드', path: '/board', icon: Kanban, seqKey: 'b' },
  { id: 'timeline', label: '타임라인', path: '/timeline', icon: GanttChart, seqKey: 'l' },
  { id: 'dashboard', label: '대시보드', path: '/dashboard', icon: LayoutDashboard, seqKey: 'd' },
  { id: 'members', label: '담당자별 현황', path: '/members', icon: Users },
  { id: 'activity', label: '활동 내역', path: '/activity', icon: History },
  { id: 'report', label: 'AI 리포트', path: '/report', icon: Sparkles },
  { id: 'automations', label: '자동화', path: '/automations', icon: Zap },
  { id: 'workspaceSettings', label: '워크스페이스 설정', path: '/workspace/settings', icon: Settings },
];

/**
 * `?item=<goalId>` 딥링크로 목표 상세를 제자리에서 여는 뷰들.
 * 그 밖의 경로에서 목표를 고르면 카드(/)로 보낸다.
 * (타임라인·대시보드는 아직 item 파라미터를 읽지 않으므로 제외)
 */
export const ITEM_PARAM_PATHS = ['/', '/table', '/board'];

/** 새 목표 작성 모달을 열면서 카드 뷰로 이동하는 경로 */
export const NEW_GOAL_PATH = '/?new=1';

/** 'g' 를 누른 뒤 다음 키를 기다리는 시간 */
export const SEQUENCE_TIMEOUT_MS = 1000;

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const source = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`;
  return /Mac|iPhone|iPad|iPod/.test(source);
}

/** 팔레트 힌트·도움말에 표시할 수정자 키 이름 */
export function modKeyLabel(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}

export interface ShortcutHint {
  /** 순서대로 누르는 키. ['G', 'C'] 는 G 다음 C */
  keys: string[];
  label: string;
}

export interface ShortcutGroup {
  title: string;
  items: ShortcutHint[];
}

/** 도움말 다이얼로그·팔레트가 함께 쓰는 단축키 목록 */
export function getShortcutGroups(): ShortcutGroup[] {
  const mod = modKeyLabel();
  return [
    {
      title: '일반',
      items: [
        { keys: [`${mod}K`], label: '명령 팔레트 열기' },
        { keys: ['?'], label: '단축키 도움말' },
        { keys: ['N'], label: '새 목표' },
        { keys: ['Esc'], label: '닫기' },
      ],
    },
    {
      title: '이동',
      items: NAV_COMMANDS.filter((c) => c.seqKey).map((c) => ({
        keys: ['G', c.seqKey!.toUpperCase()],
        label: `${c.label} 보기`,
      })),
    },
    {
      title: '팔레트 안에서',
      items: [
        { keys: ['↑ ↓'], label: '항목 이동' },
        { keys: ['↵'], label: '선택' },
      ],
    },
  ];
}
