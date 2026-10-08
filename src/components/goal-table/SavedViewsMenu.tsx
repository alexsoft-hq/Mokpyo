import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Check, Trash2, Plus, Users, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { viewsApi, SavedView } from '@/lib/api/views';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  viewType: string;               // 'table' | 'board'
  currentConfig: Record<string, unknown>;
  activeViewId: string | null;
  onApply: (view: SavedView) => void;
}

/** 저장된 뷰 선택·저장·삭제 드롭다운. 공유 뷰는 ADMIN 만 생성/삭제, 개인 뷰는 누구나. */
export function SavedViewsMenu({ projectId, viewType, currentConfig, activeViewId, onApply }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentOrganization } = useWorkspace();
  const isAdmin = currentOrganization?.role === 'OWNER' || currentOrganization?.role === 'ADMIN';
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);

  const { data: views = [] } = useQuery({
    queryKey: queryKeys.views(projectId, viewType),
    queryFn: () => viewsApi.list(projectId, viewType),
    enabled: !!projectId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.views(projectId, viewType) });

  const save = async () => {
    if (!name.trim()) return;
    try {
      await viewsApi.create({ projectId, name: name.trim(), type: viewType, isShared: shared && isAdmin, config: currentConfig });
      invalidate(); setSaveOpen(false); setName(''); setShared(false);
      toast.success('뷰를 저장했습니다.');
    } catch (e) { toast.error(e instanceof Error ? e.message : '저장 실패'); }
  };

  const remove = async (v: SavedView) => {
    if (!confirm(`'${v.name}' 뷰를 삭제할까요?`)) return;
    try { await viewsApi.remove(v.id); invalidate(); toast.success('삭제했습니다.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : '삭제 실패'); }
  };

  const active = views.find((v) => v.id === activeViewId);
  const canModify = (v: SavedView) => (v.isShared ? isAdmin || v.createdById === user?.userId : v.createdById === user?.userId);

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Bookmark className="h-4 w-4 mr-1" />{active ? active.name : '뷰'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">저장된 뷰</DropdownMenuLabel>
          {views.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">저장된 뷰가 없습니다.</div>}
          {views.map((v) => (
            <DropdownMenuItem key={v.id} onSelect={(e) => { e.preventDefault(); onApply(v); }} className="flex items-center gap-2">
              {v.id === activeViewId ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
              {v.isShared ? <Users className="h-3 w-3 text-muted-foreground" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
              <span className="flex-1 truncate">{v.name}</span>
              {canModify(v) && (
                <button onClick={(e) => { e.stopPropagation(); remove(v); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSaveOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />현재 뷰 저장
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={saveOpen} onOpenChange={setSaveOpen}>
        <PopoverTrigger asChild><span /></PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          <Input
            autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.nativeEvent.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') save(); }}
            placeholder="뷰 이름" className="h-8"
          />
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={shared} onCheckedChange={(c) => setShared(!!c)} /> 팀과 공유
            </label>
          )}
          <Button size="sm" className="w-full" onClick={save} disabled={!name.trim()}>저장</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
