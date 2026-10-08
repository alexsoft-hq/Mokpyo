import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Trash2, Pencil, Zap, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AppHeader } from '@/components/layout/AppHeader';
import { RuleBuilderDialog } from '@/components/automations/RuleBuilderDialog';
import { automationsApi, AutomationRule, TRIGGER_CATALOG, ACTION_CATALOG } from '@/lib/api/automations';
import { useFieldSchema } from '@/hooks/useFieldSchema';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { formatRelativeTime } from '@/types/activity';
import { toast } from 'sonner';

function summarize(rule: AutomationRule): string {
  const trig = TRIGGER_CATALOG.find((t) => t.value === rule.triggerType)?.label ?? rule.triggerType;
  const acts = rule.actions.map((a) => ACTION_CATALOG.find((c) => c.value === a.type)?.label ?? a.type).join(', ');
  return `${trig} → ${acts}`;
}

export default function Automations() {
  const qc = useQueryClient();
  const { currentProject } = useProject();
  const { currentOrganization } = useWorkspace();
  const projectId = currentProject?.id ?? null;
  const canManage = currentOrganization?.role === 'OWNER' || currentOrganization?.role === 'ADMIN';
  const { data: schema } = useFieldSchema();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automations', projectId],
    queryFn: () => automationsApi.list(projectId as string),
    enabled: !!projectId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['automations', projectId] });

  const toggle = async (rule: AutomationRule, enabled: boolean) => {
    try { await automationsApi.toggle(rule.id, enabled); invalidate(); }
    catch (e) { toast.error(e instanceof Error ? e.message : '실패'); }
  };
  const remove = async (rule: AutomationRule) => {
    if (!confirm(`'${rule.name}' 자동화를 삭제할까요?`)) return;
    try { await automationsApi.remove(rule.id); invalidate(); toast.success('삭제했습니다.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : '실패'); }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="자동화"
        subtitle={currentProject?.name}
        showProjectSelector={false}
        actions={canManage ? (
          <Button size="sm" className="h-9" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />규칙 추가</Button>
        ) : undefined}
      />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        {!canManage && <p className="text-sm text-muted-foreground mb-4">자동화 규칙은 관리자(OWNER/ADMIN)만 만들 수 있습니다. 아래는 현재 규칙입니다.</p>}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rules.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>아직 자동화 규칙이 없습니다.</p>
            <p className="text-sm mt-1">"~할 때 → ~한다" 규칙으로 반복 작업을 자동화하세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border bg-card">
                <div className="flex items-center gap-3 p-4">
                  <Switch checked={rule.enabled} onCheckedChange={(c) => toggle(rule, c)} disabled={!canManage} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{rule.name}</span>
                      {rule.runCount > 0 && <Badge variant="secondary" className="text-[10px]">{rule.runCount}회 실행</Badge>}
                      {rule.disabledReason && <Badge variant="destructive" className="text-[10px] gap-0.5"><AlertTriangle className="h-3 w-3" />자동 중지</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{summarize(rule)}</p>
                  </div>
                  {canManage && (
                    <>
                      <button onClick={() => { setEditing(rule); setDialogOpen(true); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(rule)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
                <Collapsible open={expanded === rule.id} onOpenChange={(o) => setExpanded(o ? rule.id : null)}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t hover:bg-muted/40">
                      실행 이력 <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ExecutionHistory ruleId={rule.id} open={expanded === rule.id} />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}
          </div>
        )}
      </div>

      {dialogOpen && projectId && (
        <RuleBuilderDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          rule={editing}
          projectId={projectId}
          statusLabels={schema?.statusLabels ?? []}
          customFields={schema?.customFields ?? []}
          onSaved={() => { invalidate(); setDialogOpen(false); }}
        />
      )}
    </div>
  );
}

function ExecutionHistory({ ruleId, open }: { ruleId: string; open: boolean }) {
  const { data: execs = [], isLoading } = useQuery({
    queryKey: ['automationRuns', ruleId],
    queryFn: () => automationsApi.executions(ruleId),
    enabled: open,
  });
  if (isLoading) return <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (execs.length === 0) return <div className="p-4 text-xs text-muted-foreground text-center">실행 이력이 없습니다.</div>;
  const statusColor: Record<string, string> = {
    SUCCESS: 'text-green-600', FAILED: 'text-destructive', CONDITION_NOT_MET: 'text-muted-foreground',
    SKIPPED_LOOP: 'text-amber-600', SKIPPED_RATE_LIMIT: 'text-amber-600',
  };
  return (
    <div className="divide-y">
      {execs.map((e) => (
        <div key={e.id} className="flex items-center justify-between px-4 py-2 text-xs">
          <span className={statusColor[e.status] ?? ''}>{e.status}</span>
          <span className="text-muted-foreground">{formatRelativeTime(e.createdAt)}{e.durationMs != null ? ` · ${e.durationMs}ms` : ''}</span>
        </div>
      ))}
    </div>
  );
}
