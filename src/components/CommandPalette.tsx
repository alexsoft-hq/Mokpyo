import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Folder, Keyboard, Plus, Target } from 'lucide-react';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useGoalsQuery } from '@/hooks/useGoalsQuery';
import { useProject } from '@/contexts/ProjectContext';
import { ITEM_PARAM_PATHS, NAV_COMMANDS, modKeyLabel } from '@/lib/shortcuts';
import { Goal } from '@/types/goal';

const GOAL_RESULT_LIMIT = 12;
const PROJECT_RESULT_LIMIT = 8;

function matches(text: string | undefined, query: string): boolean {
  if (!query) return true;
  return (text ?? '').toLowerCase().includes(query);
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenHelp: () => void;
}

/**
 * Cmd/Ctrl+K 명령 팔레트. 이동·프로젝트 전환·목표 검색·작업을 한 곳에서 처리한다.
 * 목표 목록은 팔레트가 열려 있는 동안에만 조회한다(enabled: open).
 *
 * 검색은 cmdk 기본 필터 대신 직접 처리한다(한글 부분일치 + 결과 개수 제한).
 */
export function CommandPalette({ open, onOpenChange, onOpenHelp }: CommandPaletteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, currentProject, setCurrentProject } = useProject();
  const [query, setQuery] = useState('');

  const goalsQuery = useGoalsQuery({ showCompleted: true, showOnHold: true }, { enabled: open });

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const normalized = query.trim().toLowerCase();

  const navItems = useMemo(
    () => NAV_COMMANDS.filter((c) => matches(c.label, normalized)),
    [normalized]
  );

  const projectItems = useMemo(
    () =>
      projects
        .filter((p) => p.id !== currentProject?.id && matches(p.name, normalized))
        .slice(0, PROJECT_RESULT_LIMIT),
    [projects, currentProject?.id, normalized]
  );

  const goalItems = useMemo(() => {
    const goals = goalsQuery.data ?? [];
    if (!normalized) return goals.slice(0, GOAL_RESULT_LIMIT);
    return goals
      .filter(
        (g) =>
          matches(g.title, normalized) ||
          (g.owners ?? []).some((o) => matches(o, normalized)) ||
          (g.categories ?? []).some((c) => matches(c, normalized))
      )
      .slice(0, GOAL_RESULT_LIMIT);
  }, [goalsQuery.data, normalized]);

  const actionItems = useMemo(
    () =>
      [
        { id: 'new-goal', label: '새 목표', icon: Plus, run: () => navigate('/?new=1') },
        { id: 'help', label: '단축키 도움말', icon: Keyboard, run: onOpenHelp },
      ].filter((a) => matches(a.label, normalized)),
    [normalized, navigate, onOpenHelp]
  );

  const totalCount = navItems.length + projectItems.length + goalItems.length + actionItems.length;

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const openGoal = (goal: Goal) => {
    // 각 뷰가 ?item= 으로 상세를 여는 기존 규약을 그대로 쓴다.
    const pathname = ITEM_PARAM_PATHS.includes(location.pathname) ? location.pathname : '/';
    navigate({ pathname, search: `?item=${encodeURIComponent(goal.id)}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 gap-0 shadow-lg"
        onInteractOutside={() => {
          /* 바깥 클릭으로 닫히도록 기본 동작을 막지 않는다 */
        }}
      >
        <DialogTitle className="sr-only">명령 팔레트</DialogTitle>
        <DialogDescription className="sr-only">
          화면 이동, 프로젝트 전환, 목표 검색을 한 곳에서 실행합니다.
        </DialogDescription>
        <Command
          shouldFilter={false}
          loop
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="이동할 화면, 프로젝트, 목표를 검색하세요"
            className="pr-8"
          />
          <CommandList className="max-h-[360px]">
            {totalCount === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                검색 결과가 없습니다.
              </div>
            )}

            {navItems.length > 0 && (
              <CommandGroup heading="이동">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.id}
                      value={`nav-${item.id}`}
                      onSelect={() => run(() => navigate(item.path))}
                      className="gap-2 cursor-pointer"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.label}</span>
                      {item.seqKey && (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          G {item.seqKey.toUpperCase()}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {projectItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="프로젝트 전환">
                  {projectItems.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={`project-${project.id}`}
                      onSelect={() => run(() => setCurrentProject(project))}
                      className="gap-2 cursor-pointer"
                    >
                      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{project.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {goalItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="목표">
                  {goalItems.map((goal) => (
                    <CommandItem
                      key={goal.id}
                      value={`goal-${goal.id}`}
                      onSelect={() => run(() => openGoal(goal))}
                      className="gap-2 cursor-pointer"
                    >
                      <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{goal.title}</span>
                      {(goal.owners ?? []).length > 0 && (
                        <span className="ml-auto shrink-0 max-w-[40%] truncate text-xs text-muted-foreground">
                          {(goal.owners ?? []).join(', ')}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {actionItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="작업">
                  {actionItems.map((action) => {
                    const Icon = action.icon;
                    return (
                      <CommandItem
                        key={action.id}
                        value={`action-${action.id}`}
                        onSelect={() => run(action.run)}
                        className="gap-2 cursor-pointer"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{action.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span>↑ ↓ 이동</span>
            <span>↵ 선택</span>
            <span>Esc 닫기</span>
            <span className="ml-auto">{modKeyLabel()}K 팔레트 · ? 도움말</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
