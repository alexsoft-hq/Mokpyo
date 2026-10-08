import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { AuthLayout, AuthAlert } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getLocale, useTranslation } from '@/i18n';
import { completeMcpRedirect, mcpApi, mcpConsentPath, type McpConsentRequest, type McpScope } from '@/lib/api/mcp';
import { useAuthFeedback } from './authFeedback';

export default function McpConsent() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const requestId = params.get('request') ?? '';
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <AuthLayout title={t('AI 앱 연결')} description={t('접근할 워크스페이스와 권한을 확인한 뒤 연결을 허용하세요.')}>
      {!requestId || requestId.length > 1024 ? <AuthAlert>{t('올바른 AI 연결 요청이 없습니다. AI 앱에서 다시 연결해주세요.')}</AuthAlert>
        : isLoading ? <Loading />
        : !isAuthenticated || !user ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('연결 권한을 확인하려면 Mokpyo에 로그인하세요. 로그인만으로 연결이 허용되지는 않습니다.')}</p>
            <Button asChild className="w-full"><Link to={`/login?redirect=${encodeURIComponent(mcpConsentPath(requestId))}`}>{t('로그인하고 연결 확인')}</Link></Button>
          </div>
        ) : <ConsentForm key={`${requestId}:${user.userId}`} requestId={requestId} name={user.name} email={user.email} />}
    </AuthLayout>
  );
}

function Loading() {
  const { t } = useTranslation();
  return <div role="status" className="flex items-center gap-2 py-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('연결 요청 확인 중…')}</div>;
}

function ConsentForm({ requestId, name, email }: { requestId: string; name: string; email: string }) {
  const { t } = useTranslation();
  const { organizations, currentOrganization, isLoading: workspaceLoading } = useWorkspace();
  const [request, setRequest] = useState<McpConsentRequest | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [allowWrite, setAllowWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [error, setError, setLocalError] = useAuthFeedback();
  const submitting = useRef(false);
  const active = useRef(true);
  const postController = useRef<AbortController | null>(null);
  const organizationId = selected ?? (organizations.some(org => org.id === currentOrganization?.id) ? currentOrganization!.id : organizations[0]?.id ?? '');

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    mcpApi.consent(requestId, controller.signal)
      .then(data => { if (!controller.signal.aborted) setRequest(data); })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof Error) setError(reason.message);
        else setLocalError('AI 연결 요청을 불러오지 못했습니다.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { active.current = false; controller.abort(); postController.current?.abort(); };
  }, [requestId, setError, setLocalError]);

  useEffect(() => {
    if (!request) return;
    const delay = Date.parse(request.expiresAt) - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) { setDeadlinePassed(true); return; }
    const timer = window.setTimeout(() => setDeadlinePassed(true), Math.min(delay, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [request]);

  const expired = deadlinePassed || (request ? !Number.isFinite(Date.parse(request.expiresAt)) || Date.parse(request.expiresAt) <= Date.now() : false);
  const validOrganization = organizations.some(org => org.id === organizationId);
  const canWrite = request?.requestedScopes.includes('mokpyo:write') ?? false;

  const decide = async (approved: boolean) => {
    if (submitting.current || !request || expired || Date.parse(request.expiresAt) <= Date.now() || (approved && !validOrganization)) return;
    submitting.current = true;
    setPending(true);
    setError('');
    const controller = new AbortController();
    postController.current = controller;
    const scopes: McpScope[] = ['mokpyo:read'];
    if (approved && allowWrite && canWrite) scopes.push('mokpyo:write');
    try {
      const result = await mcpApi.decide(requestId, { organizationId, scopes, approved }, controller.signal);
      if (!active.current || controller.signal.aborted) return;
      setFinished(true);
      completeMcpRedirect(result.redirectUrl, request.redirectHost);
    } catch (reason) {
      if (!active.current || controller.signal.aborted) return;
      if (reason instanceof Error) setError(reason.message);
      else setLocalError('AI 연결 요청을 처리하지 못했습니다.');
      submitting.current = false;
      setPending(false);
    }
  };

  if (loading) return <Loading />;
  if (!request) return <AuthAlert>{error || t('AI 연결 요청을 불러오지 못했습니다.')}</AuthAlert>;

  return (
    <form className="space-y-5" onSubmit={event => { event.preventDefault(); void decide(true); }}>
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
        <p className="font-semibold flex items-start gap-2 break-all"><ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />{request.clientName}</p>
        <p className="break-all"><span className="text-muted-foreground">{t('돌아갈 주소:')}</span> {request.redirectHost}</p>
        <p className="text-xs text-muted-foreground">{t('앱 이름과 반환 주소가 연결하려는 서비스와 일치하는지 확인하세요.')}</p>
      </div>
      <p className="text-sm break-words">{t('로그인한 계정:')} <strong>{name}</strong> <span className="text-muted-foreground">({email})</span></p>
      <div className="space-y-2">
        <label htmlFor="mcp-workspace" className="text-sm font-medium">{t('연결할 워크스페이스')}</label>
        <select id="mcp-workspace" className="w-full rounded-md border bg-background p-2 text-sm" value={organizationId} onChange={event => setSelected(event.target.value)} disabled={pending || finished || workspaceLoading}>
          {organizations.length === 0 && <option value="">{t('선택할 워크스페이스가 없습니다.')}</option>}
          {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">{t('권한은 선택한 워크스페이스 전체에 적용되며, 다른 워크스페이스에는 적용되지 않습니다.')}</p>
      </div>
      <fieldset className="space-y-3" disabled={pending || finished}>
        <legend className="mb-2 text-sm font-medium">{t('허용할 권한')}</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked disabled className="mt-1" />
          <span><span className="font-medium">{t('읽기 (필수)')}</span><span className="block text-xs text-muted-foreground">{t('목표, 하위 목표, 활동 이력과 진행 기록을 읽습니다.')}</span></span>
        </label>
        {canWrite && <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={allowWrite} onChange={event => setAllowWrite(event.target.checked)} className="mt-1" />
          <span><span className="font-medium">{t('목표·하위 목표 가져오기 허용 (선택)')}</span><span className="block text-xs text-muted-foreground">{t('선택한 워크스페이스에 목표와 하위 목표를 생성할 수 있습니다. 기본 설정은 읽기 전용입니다.')}</span></span>
        </label>}
      </fieldset>
      <p className="text-xs text-muted-foreground">{t('연결 요청 만료: {{date}}', { date: new Date(request.expiresAt).toLocaleString(getLocale()) })}</p>
      {expired && <AuthAlert>{t('연결 요청이 만료되었습니다. AI 앱에서 다시 연결해주세요.')}</AuthAlert>}
      {error && <AuthAlert>{error}</AuthAlert>}
      {finished && !error && <p role="status" className="text-sm">{t('AI 앱으로 돌아가는 중…')}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" disabled={pending || finished || expired} onClick={() => void decide(false)}>{t('거부')}</Button>
        <Button type="submit" className="flex-1" disabled={pending || finished || expired || workspaceLoading || !validOrganization}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden /> : null}{t('연결 허용')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('허용한 연결은 워크스페이스 설정에서 언제든 해제할 수 있습니다.')}</p>
    </form>
  );
}
