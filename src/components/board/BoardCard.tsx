import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, MessageSquare } from 'lucide-react';
import { OwnerAvatar, RegisteredUser } from '@/components/OwnerInput';
import { PriorityIcon } from '@/components/PriorityIcon';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Goal } from '@/types/goal';

interface BoardCardProps {
  goal: Goal;
  color?: string;
  users: RegisteredUser[];
  commentCount?: number;
  onOpen: () => void;
  dragging?: boolean;
}

/**
 * 칸반 스윔레인용 경량 카드. GoalCard(349줄, 그리드 span·노트·첨부) 대신 요약만.
 * 상단 색 바 = 상태 라벨색. useSortable 로 컬럼 간 드래그.
 */
export function BoardCard({ goal, color, users, commentCount = 0, onOpen, dragging }: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: goal.id,
    data: { goal },
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const owners = goal.owners?.length ? goal.owners : goal.owner ? [goal.owner] : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn(
        'group rounded-md border bg-card shadow-sm cursor-grab active:cursor-grabbing overflow-hidden',
        'hover:border-primary/40 transition-colors',
        (isDragging || dragging) && 'opacity-50 ring-2 ring-primary'
      )}
    >
      <div className="h-1" style={{ backgroundColor: color ?? 'hsl(var(--muted))' }} />
      <div className="p-2.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-snug line-clamp-2 flex-1" title={goal.title}>{goal.title}</span>
          <PriorityIcon size={goal.size} />
        </div>
        <div className="flex items-center gap-2">
          <Progress value={goal.progress} className="h-1.5 flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">{goal.progress}%</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5">
            {owners.slice(0, 3).map((o) => <OwnerAvatar key={o} ownerName={o} registeredUsers={users} size="sm" />)}
            {owners.length > 3 && <span className="text-[10px] text-muted-foreground">+{owners.length - 3}</span>}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {commentCount > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{commentCount}</span>}
            {goal.dueDate && <span className="inline-flex items-center gap-0.5"><Calendar className="h-3 w-3" />{goal.dueDate.slice(5)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
