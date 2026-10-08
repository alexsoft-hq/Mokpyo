import { useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  ColumnDef, SortingState, VisibilityState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, MessageSquare } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Goal, GoalSize } from '@/types/goal';
import { FieldSchema, StatusLabel } from '@/types/fields';
import { RegisteredUser } from '@/components/OwnerInput';
import { GroupByKey, groupGoals } from './groupGoals';
import { StatusCell, TitleCell, PersonCell, ProgressCell, DateCell, SizeCell, CustomFieldCell } from './cells';

const SIZE_RANK: Record<GoalSize, number> = { xl: 5, large: 4, medium: 3, small: 2, xs: 1 };

export interface GoalTableProps {
  goals: Goal[];
  schema: FieldSchema;
  users: RegisteredUser[];
  cycles: { id: string; name: string }[];
  groupBy: GroupByKey;
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (v: VisibilityState) => void;
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  commentCounts?: Record<string, number>;
  onStatusChange: (goal: Goal, statusId: string) => void;
  onPatch: (goal: Goal, patch: Partial<Goal>) => void;
  onFieldChange: (goal: Goal, defId: string, value: unknown) => void;
  onOpenPanel: (goal: Goal) => void;
}

export function GoalTable(props: GoalTableProps) {
  const { goals, schema, users, cycles, groupBy, sorting, onSortingChange, columnVisibility, onColumnVisibilityChange } = props;
  const statusById = useMemo(() => new Map(schema.statusLabels.map((l) => [l.id, l])), [schema.statusLabels]);
  const cycleById = useMemo(() => new Map(cycles.map((c) => [c.id, c])), [cycles]);

  // 컬럼 정의 — accessor 는 정렬용, meta.cell 은 렌더용
  const columns = useMemo<ColumnDef<Goal>[]>(() => {
    const core: ColumnDef<Goal>[] = [
      {
        id: 'status', header: '상태',
        accessorFn: (g) => (g.statusId ? statusById.get(g.statusId)?.order ?? 999 : 1000),
        meta: { width: 130, cell: (g: Goal) => <StatusCell goal={g} labels={schema.statusLabels} onChange={(sid) => props.onStatusChange(g, sid)} /> },
      },
      {
        id: 'title', header: '목표',
        accessorFn: (g) => g.title,
        meta: { width: 320, cell: (g: Goal) => (
          <div className="flex items-center gap-1.5 min-w-0">
            <TitleCell goal={g} onCommit={(t) => props.onPatch(g, { title: t })} onOpen={() => props.onOpenPanel(g)} />
            {(props.commentCounts?.[g.id] ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                <MessageSquare className="h-3 w-3" />{props.commentCounts![g.id]}
              </span>
            )}
          </div>
        ) },
      },
      {
        id: 'owners', header: '담당자',
        accessorFn: (g) => g.owners?.[0] ?? g.owner ?? '',
        meta: { width: 150, cell: (g: Goal) => <PersonCell owners={g.owners ?? []} users={users} onChange={(o) => props.onPatch(g, { owners: o, owner: o[0] ?? '' } as Partial<Goal>)} /> },
      },
      {
        id: 'progress', header: '진행률',
        accessorFn: (g) => g.progress,
        meta: { width: 140, cell: (g: Goal) => <ProgressCell goal={g} onCommit={(p) => props.onPatch(g, { progress: p })} /> },
      },
      {
        id: 'size', header: '중요도',
        accessorFn: (g) => SIZE_RANK[g.size] ?? 0,
        meta: { width: 90, cell: (g: Goal) => <SizeCell size={g.size} onChange={(s) => props.onPatch(g, { size: s })} /> },
      },
      {
        id: 'startDate', header: '시작일',
        accessorFn: (g) => g.startDate ?? '',
        meta: { width: 120, cell: (g: Goal) => <DateCell value={g.startDate} onChange={(v) => props.onPatch(g, { startDate: v ?? undefined })} /> },
      },
      {
        id: 'dueDate', header: '마감일',
        accessorFn: (g) => g.dueDate ?? '',
        meta: { width: 120, cell: (g: Goal) => <DateCell value={g.dueDate} onChange={(v) => props.onPatch(g, { dueDate: v ?? undefined })} /> },
      },
      {
        id: 'categories', header: '분류',
        accessorFn: (g) => g.categories?.[0] ?? '',
        enableSorting: false,
        meta: { width: 160, cell: (g: Goal) => (
          <div className="flex gap-1 flex-wrap">
            {(g.categories ?? []).map((c) => <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>)}
          </div>
        ) },
      },
      {
        id: 'cycle', header: '사이클',
        accessorFn: (g) => (g.cycleId ? cycleById.get(g.cycleId)?.name ?? '' : ''),
        meta: { width: 110, cell: (g: Goal) => <span className="text-xs text-muted-foreground">{g.cycleId ? cycleById.get(g.cycleId)?.name ?? '-' : '-'}</span> },
      },
    ];
    const customCols: ColumnDef<Goal>[] = schema.customFields.map((def) => ({
      id: `field:${def.id}`,
      header: def.name,
      enableSorting: false,
      meta: { width: 140, cell: (g: Goal) => (
        <CustomFieldCell def={def} value={g.customFields?.[def.id]} users={users} onChange={(v) => props.onFieldChange(g, def.id, v)} />
      ) },
    }));
    return [...core, ...customCols];
  }, [schema, statusById, cycleById, users, props]);

  const table = useReactTable({
    data: goals,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: (u) => onSortingChange(typeof u === 'function' ? u(sorting) : u),
    onColumnVisibilityChange: (u) => onColumnVisibilityChange(typeof u === 'function' ? u(columnVisibility) : u),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedGoals = table.getRowModel().rows.map((r) => r.original);
  const groups = useMemo(() => groupGoals(sortedGoals, groupBy, { statusById, cycleById }), [sortedGoals, groupBy, statusById, cycleById]);
  const visibleCols = table.getVisibleLeafColumns();

  return (
    <div className="rounded-md border">
      <Table containerClassName="max-h-[calc(100vh-240px)]">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            {visibleCols.map((col) => {
              const canSort = col.columnDef.enableSorting !== false;
              const sorted = col.getIsSorted();
              const SortIcon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
              return (
                <TableHead
                  key={col.id}
                  style={{ width: (col.columnDef.meta as any)?.width, minWidth: (col.columnDef.meta as any)?.width }}
                  className={cn('whitespace-nowrap', col.id === 'title' && 'sticky left-0 bg-card z-20')}
                  aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                >
                  <button
                    disabled={!canSort}
                    onClick={() => canSort && col.toggleSorting(sorted === 'asc')}
                    className={cn(
                      'inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      canSort && 'hover:text-foreground cursor-pointer'
                    )}
                  >
                    {String(col.columnDef.header)}
                    {canSort && <SortIcon className={cn('h-3 w-3', sorted ? 'text-foreground' : 'text-muted-foreground/40')} />}
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const collapsed = props.collapsedGroups.has(group.key);
            return (
              <GroupBlock
                key={group.key}
                group={group}
                collapsed={collapsed}
                onToggle={() => props.onToggleGroup(group.key)}
                colSpan={visibleCols.length}
                visibleCols={visibleCols}
                showGroupHeader={groupBy !== 'none'}
                statusById={statusById}
              />
            );
          })}
          {goals.length === 0 && (
            <TableRow><TableCell colSpan={visibleCols.length} className="text-center text-muted-foreground py-10">목표가 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// 그룹 헤더 + 그 그룹의 목표 행들
function GroupBlock({
  group, collapsed, onToggle, colSpan, visibleCols, showGroupHeader, statusById,
}: {
  group: ReturnType<typeof groupGoals>[number];
  collapsed: boolean;
  onToggle: () => void;
  colSpan: number;
  visibleCols: ReturnType<ReturnType<typeof useReactTable<Goal>>['getVisibleLeafColumns']>;
  showGroupHeader: boolean;
  statusById: Map<string, StatusLabel>;
}) {
  return (
    <>
      {showGroupHeader && (
        <TableRow className="bg-muted/50 hover:bg-muted/60 border-l-2" style={{ borderLeftColor: group.color ?? 'transparent' }}>
          <TableCell colSpan={colSpan} className="py-1.5">
            <button onClick={onToggle} className="inline-flex items-center gap-2 font-medium text-sm">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {group.color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />}
              <span>{group.label}</span>
              <span className="text-muted-foreground font-normal">{`${group.count}건`}</span>
              <span className="text-muted-foreground font-normal text-xs">{`· 평균 ${group.avgProgress}%`}</span>
              <span className="text-muted-foreground font-normal text-xs">{`· 완료 ${group.doneCount}/${group.count}`}</span>
            </button>
          </TableCell>
        </TableRow>
      )}
      {!collapsed && group.goals.map((goal) => (
        <TableRow key={goal.id} className="group">
          {visibleCols.map((col) => (
            <TableCell
              key={col.id}
              style={{ width: (col.columnDef.meta as any)?.width }}
              className={cn('py-1.5 align-middle', col.id === 'title' && 'sticky left-0 bg-background group-hover:bg-muted z-10')}
            >
              {(col.columnDef.meta as any)?.cell?.(goal)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
