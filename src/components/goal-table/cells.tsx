import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { MultiOwnerInput, OwnerAvatar, RegisteredUser } from '@/components/OwnerInput';
import { StatusPill, OptionChip } from '@/components/common/StatusPill';
import { PriorityIcon } from '@/components/PriorityIcon';
import { cn } from '@/lib/utils';

// 셀 트리거 공통 클래스 — 키보드 포커스 링(접근성). CategoryStatStrip 관례와 정합.
const TRIGGER = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded';
import { Goal, GoalSize } from '@/types/goal';
import { StatusLabel, CustomFieldDefinition, DropdownOption, PersonValue } from '@/types/fields';

/** IME 조합 확정 Enter 무시 + Enter=커밋 / Esc=취소 공통 키핸들러 */
function commitKeys(onCommit: () => void, onCancel: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };
}

// ---- Status cell ----
export function StatusCell({ goal, labels, onChange }: { goal: Goal; labels: StatusLabel[]; onChange: (statusId: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = labels.find((l) => l.id === goal.statusId) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn('w-full text-left', TRIGGER)}><StatusPill label={current} size="sm" /></button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="flex flex-col gap-0.5">
          {labels.map((l) => (
            <button
              key={l.id}
              onClick={() => { onChange(l.id); setOpen(false); }}
              className="flex items-center px-2 py-1.5 rounded hover:bg-accent text-left"
            >
              <OptionChip label={l.name} color={l.color} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---- Title cell (inline text + open panel) ----
export function TitleCell({ goal, onCommit, onOpen }: { goal: Goal; onCommit: (title: string) => void; onOpen: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(goal.title);
  useEffect(() => setVal(goal.title), [goal.title]);
  if (editing) {
    return (
      <Input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { setEditing(false); if (val.trim() && val !== goal.title) onCommit(val.trim()); }}
        onKeyDown={commitKeys(
          () => { setEditing(false); if (val.trim() && val !== goal.title) onCommit(val.trim()); },
          () => { setEditing(false); setVal(goal.title); }
        )}
        className="h-7 text-sm"
      />
    );
  }
  return (
    <div className="group flex items-center gap-1 min-w-0">
      <span className="truncate flex-1 cursor-text hover:text-primary" onClick={() => setEditing(true)} title={goal.title}>
        {goal.title}
      </span>
      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0" onClick={onOpen} title="열기">
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ---- Person cell ----
export function PersonCell({ owners, users, onChange }: { owners: string[]; users: RegisteredUser[]; onChange: (owners: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn('flex items-center gap-1 min-w-0 w-full text-left hover:bg-accent/50 rounded px-1 py-0.5', TRIGGER)}>
          {owners.length === 0 ? (
            <span className="text-muted-foreground text-xs">담당자 없음</span>
          ) : (
            <div className="flex items-center gap-0.5 flex-wrap">
              {owners.slice(0, 4).map((o) => (
                <OwnerAvatar key={o} ownerName={o} registeredUsers={users} size="sm" />
              ))}
              {owners.length > 4 && <span className="text-xs text-muted-foreground">+{owners.length - 4}</span>}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <MultiOwnerInput values={owners} onChange={onChange} registeredUsers={users} />
      </PopoverContent>
    </Popover>
  );
}

// ---- Progress cell (read-only when subGoals drive it) ----
export function ProgressCell({ goal, onCommit }: { goal: Goal; onCommit: (progress: number) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(goal.progress);
  useEffect(() => setVal(goal.progress), [goal.progress]);
  const readOnly = (goal.subGoals?.length ?? 0) > 0;
  const bar = (
    <div className="flex items-center gap-2 w-full">
      <Progress value={goal.progress} className="h-1.5 flex-1" />
      <span className="text-xs tabular-nums w-9 text-right">{goal.progress}%</span>
    </div>
  );
  if (readOnly) {
    return <div title="하위 목표(KR)에서 자동 산출됩니다" className="w-full cursor-help">{bar}</div>;
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button className={cn('w-full', TRIGGER)}>{bar}</button></PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <Input
          type="number" min={0} max={100} value={val}
          onChange={(e) => setVal(Math.max(0, Math.min(100, Number(e.target.value))))}
          onKeyDown={commitKeys(() => { onCommit(val); setOpen(false); }, () => { setVal(goal.progress); setOpen(false); })}
          className="h-8"
        />
        <Button size="sm" className="w-full mt-2" onClick={() => { onCommit(val); setOpen(false); }}>적용</Button>
      </PopoverContent>
    </Popover>
  );
}

// ---- Date cell ----
export function DateCell({ value, onChange }: { value?: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn('flex items-center gap-1 text-xs hover:bg-accent/50 rounded px-1 py-0.5 w-full', TRIGGER)}>
          <CalendarIcon className="h-3 w-3 text-muted-foreground shrink-0" />
          {value ? <span>{value}</span> : <span className="text-muted-foreground">-</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { onChange(d ? format(d, 'yyyy-MM-dd') : null); setOpen(false); }}
        />
        {value && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => { onChange(null); setOpen(false); }}>지우기</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---- Priority (size) cell ----
const SIZES: { value: GoalSize; label: string }[] = [
  { value: 'xl', label: '최고' }, { value: 'large', label: '높음' }, { value: 'medium', label: '중간' },
  { value: 'small', label: '낮음' }, { value: 'xs', label: '최저' },
];
export function SizeCell({ size, onChange }: { size: GoalSize; onChange: (s: GoalSize) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn('flex items-center gap-1 hover:bg-accent/50 rounded px-1 py-0.5 w-full', TRIGGER)}>
          <PriorityIcon size={size} />
          <span className="text-xs">{SIZES.find((s) => s.value === size)?.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-32 p-1" align="start">
        {SIZES.map((s) => (
          <button key={s.value} onClick={() => { onChange(s.value); setOpen(false); }} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent w-full text-left">
            <PriorityIcon size={s.value} /><span className="text-xs">{s.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ---- Custom field cell (dispatch by type) ----
export function CustomFieldCell({
  def, value, users, onChange,
}: {
  def: CustomFieldDefinition;
  value: unknown;
  users: RegisteredUser[];
  onChange: (v: unknown) => void;
}) {
  // 모든 훅은 조건 분기 위에서 호출(Rules of Hooks)
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const options: DropdownOption[] = def.config?.options ?? [];

  const commitTextNumber = () => {
    const raw = inputRef.current?.value ?? '';
    setEditing(false);
    if (def.type === 'number') {
      if (raw === '') { onChange(null); return; }
      const n = Number(raw);
      if (Number.isFinite(n)) onChange(n);
    } else {
      onChange(raw === '' ? null : raw);
    }
  };

  if (def.type === 'text' || def.type === 'number') {
    const display = value == null || value === '' ? '-' : String(value);
    if (editing) {
      return (
        <Input
          ref={inputRef}
          autoFocus
          type={def.type === 'number' ? 'number' : 'text'}
          defaultValue={value == null ? '' : String(value)}
          onBlur={commitTextNumber}
          onKeyDown={commitKeys(commitTextNumber, () => setEditing(false))}
          className="h-7 text-sm"
        />
      );
    }
    return (
      <button className={cn('w-full text-left text-sm hover:bg-accent/50 rounded px-1 py-0.5 truncate', TRIGGER)} onClick={() => setEditing(true)}>
        {display}{def.config?.unit && display !== '-' ? ` ${def.config.unit}` : ''}
      </button>
    );
  }

  if (def.type === 'date') {
    return <DateCell value={typeof value === 'string' ? value : null} onChange={(v) => onChange(v)} />;
  }

  if (def.type === 'dropdown' || def.type === 'priority') {
    const multi = def.type === 'dropdown' && def.config?.multi;
    const selectedIds: string[] = multi ? (Array.isArray(value) ? (value as string[]) : []) : value ? [value as string] : [];
    const selectedOpts = options.filter((o) => selectedIds.includes(o.id));
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className={cn('flex items-center gap-1 flex-wrap w-full text-left hover:bg-accent/50 px-1 py-0.5 min-h-[24px]', TRIGGER)}>
            {selectedOpts.length === 0 ? <span className="text-muted-foreground text-xs">-</span> :
              selectedOpts.map((o) => <OptionChip key={o.id} label={o.label} color={o.color} />)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start">
          {options.map((o) => {
            const on = selectedIds.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => {
                  if (multi) {
                    const next = on ? selectedIds.filter((x) => x !== o.id) : [...selectedIds, o.id];
                    onChange(next);
                  } else { onChange(on ? null : o.id); setOpen(false); }
                }}
                className={cn('flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent w-full text-left', on && 'bg-accent/60')}
              >
                <OptionChip label={o.label} color={o.color} />
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    );
  }

  if (def.type === 'person') {
    const people: PersonValue[] = Array.isArray(value) ? (value as PersonValue[]) : [];
    const names = people.map((p) => p.name);
    return (
      <PersonCell
        owners={names}
        users={users}
        onChange={(nextNames) => onChange(nextNames.map((n) => ({ userId: users.find((u) => u.name === n)?.id ?? null, name: n })))}
      />
    );
  }

  return <span className="text-xs text-muted-foreground">-</span>;
}
