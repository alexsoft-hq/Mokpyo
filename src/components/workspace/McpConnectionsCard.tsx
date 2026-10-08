import { useEffect, useRef, useState } from 'react';
import { Copy, Loader2, Plug, Unplug } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getLocale, useTranslation } from '@/i18n';
import { mcpApi, type McpConnections } from '@/lib/api/mcp';

export function McpConnectionsCard({ orgId }: { orgId: string }) {
  // Remount the scoped body immediately, before effects, when switching workspaces.
  return <ConnectionsBody key={orgId} orgId={orgId} />;
}

function ConnectionsBody({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<McpConnections | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());
  const revokeLock = useRef(false);
  const active = useRef(true);
  const revokeController = useRef<AbortController | null>(null);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; revokeController.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    mcpApi.connections(orgId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'AI 연결 목록을 불러오지 못했습니다.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orgId, refresh]);

  const revoke = async (id: string) => {
    if (revokeLock.current) return;
    revokeLock.current = true;
    setRevoking(id);
    setError('');
    setNotice('');
    const controller = new AbortController();
    revokeController.current = controller;
    try {
      await mcpApi.revoke(orgId, id, controller.signal);
      if (!active.current || controller.signal.aborted) return;
      setRevokedIds(previous => new Set(previous).add(id));
      setNotice('AI 연결을 해제했습니다.');
    } catch (reason) {
      if (active.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'AI 연결을 해제하지 못했습니다.');
    } finally {
      if (active.current && !controller.signal.aborted) { revokeLock.current = false; setRevoking(null); }
    }
  };

  const copyEndpoint = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.endpoint);
      if (active.current) { setNotice('MCP 서버 주소를 복사했습니다.'); setError(''); }
    } catch {
      if (active.current) setError('주소를 복사하지 못했습니다. 서버 주소를 직접 선택해 복사하세요.');
    }
  };
  const date = (value: string) => new Date(value).toLocaleString(getLocale());

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Plug className="h-5 w-5" aria-hidden />{t('내 AI 연결 (MCP)')}</CardTitle>
        <CardDescription>{t('Claude 등 사용 중인 AI 앱을 연결하고, 이 워크스페이스에 허용한 내 접근 권한을 관리합니다.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('Claude의 커넥터 추가 화면에 아래 MCP 서버 주소를 입력하세요. Mokpyo 로그인 후 워크스페이스와 권한을 직접 선택합니다.')}</p>
        <p className="text-xs text-muted-foreground">{t('AI 앱이 이 서버에 접근할 수 있어야 합니다. 앱의 커넥터 지원과 요금제·사용량 제한이 적용됩니다.')}</p>
        {data && <div className="space-y-2">
          <label htmlFor={`mcp-endpoint-${orgId}`} className="text-sm font-medium">{t('MCP 서버 주소')}</label>
          <div className="flex gap-2 items-start">
            <input id={`mcp-endpoint-${orgId}`} value={data.endpoint} readOnly className="min-w-0 flex-1 rounded-md border bg-muted/30 p-2 font-mono text-xs" onFocus={event => event.target.select()} />
            <Button type="button" variant="outline" size="sm" onClick={() => void copyEndpoint()} aria-label={t('MCP 서버 주소 복사')}><Copy className="h-4 w-4 mr-1" aria-hidden />{t('복사')}</Button>
          </div>
        </div>}
        {error && <div role="alert" className="text-sm text-destructive">{t(error)}</div>}
        {notice && <p role="status" className="text-sm">{t(notice)}</p>}
        {loading ? <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('불러오는 중…')}</div> : !data ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setRefresh(value => value + 1)}>{t('다시 시도')}</Button>
        ) : data.connections.length === 0 ? <p className="text-sm text-muted-foreground">{t('이 워크스페이스에 허용한 AI 연결이 없습니다.')}</p> : (
          <ul className="divide-y rounded-lg border">
            {data.connections.map(connection => {
              const revoked = !!connection.revokedAt || revokedIds.has(connection.id);
              return <li key={connection.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm break-words">{connection.name}</p>
                    <p className="text-xs text-muted-foreground">{connection.scopes.includes('mokpyo:write') ? t('읽기 및 목표·하위 목표 가져오기') : t('읽기 전용')}</p>
                  </div>
                  {revoked ? <span className="shrink-0 text-xs text-muted-foreground">{t('해제됨')}</span>
                    : <Button type="button" size="sm" variant="outline" disabled={revoking !== null} onClick={() => void revoke(connection.id)} aria-label={t('{{name}} 연결 해제', { name: connection.name })}>
                      {revoking === connection.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden /> : <Unplug className="h-4 w-4 mr-1" aria-hidden />}{t('연결 해제')}
                    </Button>}
                </div>
                <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div><dt className="inline">{t('연결일:')}</dt> <dd className="inline">{date(connection.createdAt)}</dd></div>
                  <div><dt className="inline">{t('액세스 토큰 만료:')}</dt> <dd className="inline">{date(connection.expiresAt)}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline">{t('최근 사용:')}</dt> <dd className="inline">{connection.lastUsedAt ? date(connection.lastUsedAt) : t('아직 사용하지 않음')}</dd></div>
                </dl>
              </li>;
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t('액세스 토큰은 AI 앱이 갱신할 수 있습니다. 토큰 만료 시각이 지나도 연결 해제로 간주하지 않습니다.')}</p>
        <p className="text-xs text-muted-foreground">{t('연결 권한은 이 워크스페이스 전체에 적용됩니다. 여기서는 내가 허용한 연결만 해제할 수 있습니다.')}</p>
      </CardContent>
    </Card>
  );
}
