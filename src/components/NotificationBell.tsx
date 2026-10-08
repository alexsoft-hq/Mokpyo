import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api, type AppNotification } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';

function timeAgo(iso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export function NotificationBell() {
  const { currentOrganization } = useWorkspace();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setUnread(await api.getUnreadNotificationCount());
    } catch {
      /* 조용히 무시 — 백그라운드 폴링 */
    }
  }, [currentOrganization]);

  // 마운트 시 + 60초 주기로 안 읽은 수 폴링 (조직 전환 시 재설정)
  useEffect(() => {
    refreshCount();
    const timer = setInterval(refreshCount, 60000);
    return () => clearInterval(timer);
  }, [refreshCount]);

  // 탭으로 돌아오면 즉시 갱신 → 폴링만으로는 최대 60초 지연을 체감상 실시간에 가깝게
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshCount();
    };
    window.addEventListener('focus', refreshCount);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refreshCount);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshCount]);

  const loadList = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      setItems(await api.getNotifications(30));
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) loadList();
  };

  const handleClickItem = async (n: AppNotification) => {
    if (n.read) return;
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api.markNotificationRead(n.id);
    } catch {
      /* 낙관적 업데이트 유지 */
    }
  };

  const handleReadAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    try {
      await api.markAllNotificationsRead();
    } catch {
      /* noop */
    }
  };

  if (!currentOrganization) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          aria-label={unread > 0 ? `알림 (안 읽음 ${unread}건)` : '알림'}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">알림</span>
          {unread > 0 && (
            <button
              onClick={handleReadAll}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> 모두 읽음
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">새 알림이 없습니다.</div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClickItem(n)}
                    className={`flex w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-muted ${n.read ? '' : 'bg-primary/10'}`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-primary'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-snug line-clamp-2 ${n.read ? 'font-medium' : 'font-semibold'}`}>
                        {!n.read && <span className="sr-only">안 읽음: </span>}
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground line-clamp-2">
                          {n.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
