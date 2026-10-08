import { useState } from 'react';
import { Cycle, CycleOverlapPreview, api } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CalendarRange, ListPlus, Plus, Settings2, Trash2 } from 'lucide-react';

const ALL_VALUE = '__all__';
const MANAGE_VALUE = '__manage__';

const CYCLE_TYPES: { value: string; label: string }[] = [
  { value: 'quarter', label: '분기' },
  { value: 'half', label: '반기' },
  { value: 'annual', label: '연간' },
  { value: 'custom', label: '사용자 지정' },
];

const toDateInput = (value?: string) => (value ? value.slice(0, 10) : '');

interface CycleFilterProps {
  cycles: Cycle[];
  selectedCycleId: string;
  onCycleChange: (id: string) => void;
  /** OWNER/ADMIN일 때만 "사이클 관리…" 항목 노출 */
  canManage?: boolean;
  /** 생성/수정/삭제 후 부모가 사이클 목록을 다시 불러오도록 호출 */
  onCyclesChange?: () => void;
  /** 목표 일괄 배정 후 부모가 목표 목록을 다시 불러오도록 호출 */
  onGoalsChange?: () => void;
  className?: string;
}

export const CycleFilter = ({
  cycles,
  selectedCycleId,
  onCycleChange,
  canManage = false,
  onCyclesChange,
  onGoalsChange,
  className,
}: CycleFilterProps) => {
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <>
      <Select
        value={selectedCycleId || ALL_VALUE}
        onValueChange={(value) => {
          if (value === MANAGE_VALUE) {
            setManageOpen(true);
            return;
          }
          onCycleChange(value === ALL_VALUE ? '' : value);
        }}
      >
        <SelectTrigger
          className={cn('h-9 w-auto min-w-[130px] max-w-[200px] gap-1.5 text-sm', className)}
          aria-label="사이클 필터"
        >
          <CalendarRange className="w-4 h-4 text-muted-foreground shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>전체 사이클</SelectItem>
          {cycles.map((cycle) => (
            <SelectItem key={cycle.id} value={cycle.id}>
              {cycle.name}
            </SelectItem>
          ))}
          {canManage && (
            <>
              <SelectSeparator />
              <SelectItem value={MANAGE_VALUE}>
                <span className="flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5" />
                  사이클 관리…
                </span>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      {canManage && (
        <CycleManageDialog
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          cycles={cycles}
          onChanged={onCyclesChange}
          onGoalsChanged={onGoalsChange}
        />
      )}
    </>
  );
};

interface CycleManageDialogProps {
  open: boolean;
  onClose: () => void;
  cycles: Cycle[];
  onChanged?: () => void;
  onGoalsChanged?: () => void;
}

const CycleManageDialog = ({ open, onClose, cycles, onChanged, onGoalsChanged }: CycleManageDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">사이클 관리</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            {cycles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                등록된 사이클이 없습니다. 아래에서 새 사이클을 추가하세요.
              </p>
            ) : (
              cycles.map((cycle) => (
                <CycleRow key={cycle.id} cycle={cycle} onChanged={onChanged} onGoalsChanged={onGoalsChanged} />
              ))
            )}
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-2">새 사이클 추가</h4>
            <CycleAddForm onChanged={onChanged} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CycleTypeSelect = ({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="h-9">
      <SelectValue placeholder="유형" />
    </SelectTrigger>
    <SelectContent>
      {CYCLE_TYPES.map((t) => (
        <SelectItem key={t.value} value={t.value}>
          {t.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const CycleRow = ({
  cycle,
  onChanged,
  onGoalsChanged,
}: {
  cycle: Cycle;
  onChanged?: () => void;
  onGoalsChanged?: () => void;
}) => {
  const [name, setName] = useState(cycle.name);
  const [type, setType] = useState(cycle.type || 'quarter');
  const [startDate, setStartDate] = useState(toDateInput(cycle.startDate));
  const [endDate, setEndDate] = useState(toDateInput(cycle.endDate));
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<CycleOverlapPreview | null>(null);

  const handlePreviewOverlaps = async () => {
    try {
      setBusy(true);
      const result = await api.getCycleUnassignedOverlaps(cycle.id);
      if (result.count === 0) {
        alert('이 사이클 기간과 겹치는 미배정 목표가 없습니다.');
        setPreview(null);
        return;
      }
      setPreview(result);
    } catch (error) {
      console.error('Failed to preview overlapping goals:', error);
      alert(error instanceof Error ? error.message : '배정 대상 목표 조회에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleAssignOverlaps = async () => {
    if (!preview) return;
    try {
      setBusy(true);
      // 미리보기에서 확인한 목록만 배정 — 그 사이 기간 변경/신규 목표가 휩쓸리지 않도록
      const { assigned } = await api.assignCycleOverlaps(cycle.id, preview.goals.map((g) => g.id));
      setPreview(null);
      onGoalsChanged?.();
      alert(`${assigned}건의 목표를 '${cycle.name}' 사이클에 배정했습니다.`);
    } catch (error) {
      console.error('Failed to assign overlapping goals:', error);
      alert(error instanceof Error ? error.message : '목표 일괄 배정에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) {
      alert('이름, 시작일, 종료일을 모두 입력하세요.');
      return;
    }
    try {
      setBusy(true);
      await api.updateCycle(cycle.id, { name: name.trim(), type, startDate, endDate });
      // 기간이 바뀌면 열려 있던 미리보기는 낡은 정보 — 무효화
      setPreview(null);
      onChanged?.();
    } catch (error) {
      console.error('Failed to update cycle:', error);
      alert(error instanceof Error ? error.message : '사이클 수정에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`'${cycle.name}' 사이클을 삭제하시겠습니까?`)) return;
    try {
      setBusy(true);
      await api.deleteCycle(cycle.id);
      setPreview(null);
      onChanged?.();
    } catch (error) {
      console.error('Failed to delete cycle:', error);
      alert(error instanceof Error ? error.message : '사이클 삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">이름</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs">유형</Label>
          <div className="mt-1">
            <CycleTypeSelect value={type} onValueChange={setType} />
          </div>
        </div>
        <div>
          <Label className="text-xs">시작일</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 h-9"
          />
        </div>
        <div>
          <Label className="text-xs">종료일</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 h-9"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviewOverlaps}
          disabled={busy}
          title="시작일·마감일이 이 사이클 기간과 겹치는 '사이클 미지정' 목표를 찾아 일괄 배정합니다"
        >
          <ListPlus className="w-4 h-4 mr-1" />
          목표 일괄 배정
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={busy} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-1" />
            삭제
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={busy}>
            저장
          </Button>
        </div>
      </div>

      {preview && (
        <div className="rounded-md border bg-background p-3 space-y-2">
          <p className="text-sm font-medium" role="status">
            기간이 겹치는 미배정 목표 <span className="text-primary">{preview.count}건</span> — 아래 목표가
            이 사이클에 배정됩니다.
          </p>
          <ul className="max-h-40 overflow-y-auto space-y-1 pr-1">
            {preview.goals.map((g) => (
              <li key={g.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{g.title}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {g.projectName} · {g.startDate || '—'} ~ {g.dueDate || '—'}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)} disabled={busy}>
              취소
            </Button>
            <Button size="sm" onClick={handleAssignOverlaps} disabled={busy}>
              {preview.count}건 배정
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const CycleAddForm = ({ onChanged }: { onChanged?: () => void }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('quarter');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setType('quarter');
    setStartDate('');
    setEndDate('');
  };

  const handleAdd = async () => {
    if (!name.trim() || !startDate || !endDate) {
      alert('이름, 시작일, 종료일을 모두 입력하세요.');
      return;
    }
    try {
      setBusy(true);
      await api.createCycle({ name: name.trim(), type, startDate, endDate });
      reset();
      onChanged?.();
    } catch (error) {
      console.error('Failed to create cycle:', error);
      alert(error instanceof Error ? error.message : '사이클 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 bg-background rounded-lg border space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">이름</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 2026 1분기"
            className="mt-1 h-9"
          />
        </div>
        <div>
          <Label className="text-xs">유형</Label>
          <div className="mt-1">
            <CycleTypeSelect value={type} onValueChange={setType} />
          </div>
        </div>
        <div>
          <Label className="text-xs">시작일</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 h-9"
          />
        </div>
        <div>
          <Label className="text-xs">종료일</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 h-9"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={handleAdd} disabled={busy}>
          <Plus className="w-4 h-4 mr-1" />
          추가
        </Button>
      </div>
    </div>
  );
};
