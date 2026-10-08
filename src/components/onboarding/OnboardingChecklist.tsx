import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useOrgUsers } from '@/hooks/useOrgUsers';
import { cn } from '@/lib/utils';
import { onboardingBoardVisitedKey, onboardingDismissedKey, readFlag, writeFlag } from './storage';

/** 목표가 이만큼 쌓였으면 이미 익숙한 사용자로 보고 체크리스트를 띄우지 않는다. */
const HIDE_ABOVE_GOAL_COUNT = 10;

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  to?: string;
  onClick?: () => void;
  actionLabel?: string;
}

export interface OnboardingChecklistProps {
  /** 현재 프로젝트의 목표 수 */
  goalCount: number;
  /** '첫 목표 추가' 를 눌렀을 때 */
  onAddGoal: () => void;
  className?: string;
}

export function OnboardingChecklist({ goalCount, onAddGoal, className }: OnboardingChecklistProps) {
  const { currentOrganization } = useWorkspace();
  const { projects } = useProject();
  const usersQuery = useOrgUsers();
  const orgId = currentOrganization?.id ?? '';

  const [dismissed, setDismissed] = useState(() => (orgId ? readFlag(onboardingDismissedKey(orgId)) : false));
  const [boardVisited, setBoardVisited] = useState(() =>
    orgId ? readFlag(onboardingBoardVisitedKey(orgId)) : false
  );

  // 워크스페이스를 바꾸면 그 워크스페이스의 상태를 다시 읽는다.
  useEffect(() => {
    if (!orgId) return;
    setDismissed(readFlag(onboardingDismissedKey(orgId)));
    setBoardVisited(readFlag(onboardingBoardVisitedKey(orgId)));
  }, [orgId]);

  const memberCount = usersQuery.data?.length ?? 0;

  const items = useMemo<ChecklistItem[]>(
    () => [
      { id: 'project', label: '프로젝트 만들기', done: projects.length > 0 },
      {
        id: 'goal',
        label: '첫 목표 추가하기',
        done: goalCount > 0,
        onClick: onAddGoal,
        actionLabel: '추가',
      },
      {
        id: 'invite',
        label: '팀원 초대하기',
        done: memberCount >= 2,
        to: '/workspace/settings',
        actionLabel: '초대',
      },
      {
        id: 'board',
        label: '보드에서 상태 바꿔보기',
        done: boardVisited,
        to: '/board',
        actionLabel: '열기',
      },
    ],
    [projects.length, goalCount, memberCount, boardVisited, onAddGoal]
  );

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  // 다 끝냈으면 다음부터는 나오지 않게 기록한다.
  useEffect(() => {
    if (allDone && orgId && !dismissed) {
      writeFlag(onboardingDismissedKey(orgId));
      setDismissed(true);
    }
  }, [allDone, orgId, dismissed]);

  if (!orgId || dismissed || goalCount >= HIDE_ABOVE_GOAL_COUNT) return null;

  const handleDismiss = () => {
    writeFlag(onboardingDismissedKey(orgId));
    setDismissed(true);
  };

  return (
    <Card className={cn('rounded-xl p-4 md:p-5 mb-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">시작하기</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            네 단계만 마치면 팀과 함께 쓸 준비가 끝납니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {doneCount}/{items.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDismiss}
            aria-label="시작하기 안내 닫기"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Progress value={(doneCount / items.length) * 100} className="mt-3 h-1.5" />

      <ul className="mt-3 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 py-1 text-sm">
            {item.done ? (
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <Check className="h-3 w-3" />
              </span>
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            )}
            <span className={cn(item.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
              {item.label}
            </span>
            {!item.done && item.to && (
              <Button asChild variant="link" size="sm" className="ml-auto h-auto p-0 text-xs">
                <Link to={item.to}>{item.actionLabel ?? '이동'}</Link>
              </Button>
            )}
            {!item.done && !item.to && item.onClick && (
              <Button
                variant="link"
                size="sm"
                className="ml-auto h-auto p-0 text-xs"
                onClick={item.onClick}
              >
                {item.actionLabel ?? '이동'}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
