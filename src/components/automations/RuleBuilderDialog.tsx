import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiOwnerInput } from '@/components/OwnerInput';
import { automationsApi, AutomationRule, AutomationAction, TRIGGER_CATALOG, ACTION_CATALOG } from '@/lib/api/automations';
import { StatusLabel, CustomFieldDefinition } from '@/types/fields';
import { useOrgUsers } from '@/hooks/useOrgUsers';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  rule: AutomationRule | null;
  projectId: string;
  statusLabels: StatusLabel[];
  customFields: CustomFieldDefinition[];
  onSaved: () => void;
}

export function RuleBuilderDialog({ open, onClose, rule, projectId, statusLabels, customFields, onSaved }: Props) {
  const { data: users = [] } = useOrgUsers();
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('goal_created');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [actions, setActions] = useState<AutomationAction[]>([{ type: 'notify_person', config: {} }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(rule?.name ?? '');
    setTriggerType(rule?.triggerType ?? 'goal_created');
    setTriggerConfig(rule?.triggerConfig ?? {});
    setActions(rule?.actions?.length ? rule.actions : [{ type: 'notify_person', config: {} }]);
  }, [open, rule]);

  const trigMeta = TRIGGER_CATALOG.find((t) => t.value === triggerType);

  const nameToUserId = (names: string[]) => names.map((n) => users.find((u) => u.name === n)?.id).filter(Boolean) as string[];
  const userIdsToNames = (ids: unknown) => (Array.isArray(ids) ? ids : []).map((id) => users.find((u) => u.id === id)?.name).filter(Boolean) as string[];

  const setAction = (i: number, patch: Partial<AutomationAction>) =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const save = async () => {
    if (!name.trim()) { toast.error('이름을 입력하세요.'); return; }
    setSaving(true);
    try {
      const payload = { projectId, name: name.trim(), triggerType, triggerConfig, actions };
      if (rule) await automationsApi.update(rule.id, payload);
      else await automationsApi.create(payload);
      toast.success(rule ? '수정했습니다.' : '자동화를 추가했습니다.');
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : '저장 실패'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{rule ? '자동화 편집' : '자동화 규칙 만들기'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 완료 시 담당자 알림" />
          </div>

          {/* 트리거 */}
          <div className="space-y-1.5 rounded-md border p-3 bg-muted/30">
            <label className="text-sm font-medium">언제 (트리거)</label>
            <Select value={triggerType} onValueChange={(v) => { setTriggerType(v); setTriggerConfig({}); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TRIGGER_CATALOG.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            {trigMeta?.needs === 'status' && (
              <Select value={(triggerConfig.toStatusId as string) ?? ''} onValueChange={(v) => setTriggerConfig({ toStatusId: v })}>
                <SelectTrigger><SelectValue placeholder="대상 상태 선택" /></SelectTrigger>
                <SelectContent>{statusLabels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {trigMeta?.needs === 'progress' && (
              <Input type="number" min={0} max={100} placeholder="도달 진행률 %" value={(triggerConfig.threshold as number) ?? ''} onChange={(e) => setTriggerConfig({ threshold: Number(e.target.value) })} />
            )}
            {trigMeta?.needs === 'days' && (
              <Input type="number" min={1} placeholder="며칠 전 (기본 3)" value={(triggerConfig.daysBefore as number) ?? ''} onChange={(e) => setTriggerConfig({ daysBefore: Number(e.target.value) })} />
            )}
          </div>

          {/* 액션 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">무엇을 (액션)</label>
            {actions.map((action, i) => {
              const meta = ACTION_CATALOG.find((a) => a.value === action.type);
              return (
                <div key={i} className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Select value={action.type} onValueChange={(v) => setAction(i, { type: v, config: {} })}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{ACTION_CATALOG.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {actions.length > 1 && <button aria-label="액션 삭제" onClick={() => setActions((p) => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  {(meta?.needs === 'status') && (
                    <Select value={(action.config.statusId as string) ?? ''} onValueChange={(v) => setAction(i, { config: { ...action.config, statusId: v } })}>
                      <SelectTrigger><SelectValue placeholder="상태 선택" /></SelectTrigger>
                      <SelectContent>{statusLabels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {meta?.needs === 'people' && (
                    <MultiOwnerInput
                      values={userIdsToNames(action.config.userIds)}
                      onChange={(names) => setAction(i, { config: { ...action.config, userIds: nameToUserId(names) } })}
                      registeredUsers={users}
                    />
                  )}
                  {meta?.needs === 'text' && (
                    <Input placeholder="댓글 내용" value={(action.config.body as string) ?? ''} onChange={(e) => setAction(i, { config: { ...action.config, body: e.target.value } })} />
                  )}
                  {meta?.needs === 'webhook' && (
                    <div className="space-y-2">
                      <Input type="url" placeholder="https://hooks.example.com/..." value={(action.config.url as string) ?? ''} onChange={(e) => setAction(i, { config: { ...action.config, url: e.target.value } })} />
                      <Input placeholder="서명 비밀키(선택) — X-Mokpyo-Signature 헤더에 HMAC-SHA256 으로 서명됩니다" value={(action.config.secret as string) ?? ''} onChange={(e) => setAction(i, { config: { ...action.config, secret: e.target.value } })} />
                      <p className="text-xs text-muted-foreground">목표 정보와 변경 내용을 JSON 으로 POST 합니다. https 공개 주소만 허용됩니다.</p>
                    </div>
                  )}
                  {meta?.needs === 'field' && (
                    <div className="space-y-2">
                      <Select value={(action.config.fieldId as string) ?? ''} onValueChange={(v) => setAction(i, { config: { ...action.config, fieldId: v } })}>
                        <SelectTrigger><SelectValue placeholder="필드 선택" /></SelectTrigger>
                        <SelectContent>{customFields.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input placeholder="설정할 값" value={(action.config.value as string) ?? ''} onChange={(e) => setAction(i, { config: { ...action.config, value: e.target.value } })} />
                    </div>
                  )}
                </div>
              );
            })}
            {actions.length < 5 && (
              <Button variant="outline" size="sm" onClick={() => setActions((p) => [...p, { type: 'notify_person', config: {} }])}><Plus className="h-4 w-4 mr-1" />액션 추가</Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>{rule ? '저장' : '만들기'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
