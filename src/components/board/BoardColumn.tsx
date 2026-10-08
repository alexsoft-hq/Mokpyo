import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';
import { ChevronLeft, MoreHorizontal, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Goal } from '@/types/goal';
import { RegisteredUser } from '@/components/OwnerInput';
import { BoardCard } from './BoardCard';

export interface BoardColumnData {
  id: string;          // status label id, 또는 '__none__'
  name: string;
  color?: string;
  kind?: string;
  isSystem?: boolean;
  goals: Goal[];
}

interface BoardColumnProps {
  column: BoardColumnData;
  users: RegisteredUser[];
  commentCounts?: Record<string, number>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  canManage: boolean;
  doneCap?: number; // done 컬럼 표시 상한(무한 로드 방어)
  onOpenGoal: (g: Goal) => void;
  onRename?: () => void;
  onDelete?: () => void;
  onAddGoal?: () => void;
}

export function BoardColumn({
  column, users, commentCounts, collapsed, onToggleCollapse, canManage, doneCap,
  onOpenGoal, onRename, onDelete, onAddGoal,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { columnId: column.id } });
  const [showAll, setShowAll] = useState(false);
  const isDone = column.kind === 'done';
  const capped = isDone && doneCap != null && !showAll ? column.goals.slice(0, doneCap) : column.goals;
  const hiddenCount = column.goals.length - capped.length;

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="flex flex-col items-center gap-2 w-10 shrink-0 rounded-md border bg-muted/40 py-3 hover:bg-muted"
        title={`${column.name} (${column.goals.length})`}
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color ?? 'hsl(var(--muted-foreground))' }} />
        <span className="text-xs [writing-mode:vertical-rl] font-medium">{column.name}</span>
        <span className="text-[10px] text-muted-foreground">{column.goals.length}</span>
      </button>
    );
  }

  return (
    <div ref={setNodeRef} className={cn('flex flex-col w-72 shrink-0 rounded-md border bg-muted/30', isOver && 'ring-2 ring-primary')}>
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color ?? 'hsl(var(--muted-foreground))' }} />
        <span className="font-medium text-sm truncate flex-1" title={column.name}>{column.name}</span>
        <span className="text-xs text-muted-foreground">{column.goals.length}</span>
        <button onClick={onToggleCollapse} className="text-muted-foreground hover:text-foreground" title="접기"><ChevronLeft className="h-4 w-4" /></button>
        {canManage && column.id !== '__none__' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button aria-label="컬럼 메뉴" className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRename}><Pencil className="h-4 w-4 mr-2" />이름·색상 변경</DropdownMenuItem>
              {!column.isSystem && <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />삭제</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <SortableContext items={capped.map((g) => g.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-260px)]">
          {capped.map((g) => (
            <BoardCard key={g.id} goal={g} color={column.color} users={users} commentCount={commentCounts?.[g.id]} onOpen={() => onOpenGoal(g)} />
          ))}
          {hiddenCount > 0 && (
            <button onClick={() => setShowAll(true)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">
              + {hiddenCount}개 더 보기
            </button>
          )}
          {column.goals.length === 0 && <div className="text-center text-xs text-muted-foreground py-6">비어 있음</div>}
        </div>
      </SortableContext>
      {onAddGoal && column.id !== '__none__' && (
        <button onClick={onAddGoal} className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border-t">
          <Plus className="h-3.5 w-3.5" />목표 추가
        </button>
      )}
    </div>
  );
}
