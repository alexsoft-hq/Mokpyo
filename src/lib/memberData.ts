import { Goal, SubGoal } from '@/types/goal';

export interface MemberData {
  name: string;
  goals: GoalWithRole[];
  subGoals: SubGoalWithParent[];
  totalCount: number;
  completedCount: number;
  onHoldCount: number;
  avgProgress: number;
}

export interface GoalWithRole extends Goal {
  role: 'owner';
}

export interface SubGoalWithParent extends SubGoal {
  parentGoalTitle: string;
  parentGoalId: string;
  parentCompleted?: boolean;
  parentOnHold?: boolean;
}

export function buildMemberData(goals: Goal[]): MemberData[] {
  const memberMap = new Map<string, MemberData>();

  const getOrCreate = (name: string): MemberData => {
    if (!memberMap.has(name)) {
      memberMap.set(name, {
        name,
        goals: [],
        subGoals: [],
        totalCount: 0,
        completedCount: 0,
        onHoldCount: 0,
        avgProgress: 0,
      });
    }
    return memberMap.get(name)!;
  };

  for (const goal of goals) {
    // 복수 담당자: 각 담당자별로 그룹에 추가
    const goalOwners = goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner];
    const addedGoalMembers = new Set<string>();
    for (const ownerName of goalOwners) {
      if (!ownerName || addedGoalMembers.has(ownerName)) continue;
      addedGoalMembers.add(ownerName);
      const member = getOrCreate(ownerName);
      member.goals.push({ ...goal, role: 'owner' });
    }

    if (goal.subGoals) {
      for (const sub of goal.subGoals) {
        const subOwners = sub.owners && sub.owners.length > 0 ? sub.owners : [sub.owner];
        const addedSubMembers = new Set<string>();
        for (const ownerName of subOwners) {
          if (!ownerName || addedSubMembers.has(ownerName)) continue;
          addedSubMembers.add(ownerName);
          const subMember = getOrCreate(ownerName);
          subMember.subGoals.push({
            ...sub,
            parentGoalTitle: goal.title,
            parentGoalId: goal.id,
            parentCompleted: goal.completed,
            parentOnHold: goal.onHold,
          });
        }
      }
    }
  }

  for (const member of memberMap.values()) {
    const allItems: { progress: number; completed?: boolean; onHold?: boolean }[] = [
      ...member.goals.map((g) => ({ progress: g.progress, completed: g.completed, onHold: g.onHold })),
      ...member.subGoals.map((s) => ({
        progress: s.progress,
        completed: s.progress === 100,
        onHold: false,
      })),
    ];

    member.totalCount = allItems.length;
    member.completedCount = allItems.filter((i) => i.completed).length;
    member.onHoldCount = member.goals.filter((g) => g.onHold).length;

    if (allItems.length > 0) {
      member.avgProgress = Math.round(
        allItems.reduce((sum, i) => sum + i.progress, 0) / allItems.length
      );
    }
  }

  return Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export function getProgressColor(progress: number): string {
  if (progress >= 80) return 'text-green-600 dark:text-green-400';
  if (progress >= 50) return 'text-blue-600 dark:text-blue-400';
  if (progress >= 20) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-muted-foreground';
}
