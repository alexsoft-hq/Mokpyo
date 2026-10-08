import { formatNumber, t, useTranslation } from '@/i18n';
import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getOrganizationBilling, type OrgBilling } from '@/lib/api/organizations';

const formatBytes = (n: number) => {
  if (n >= 1024 ** 3) return `${formatNumber(n / 1024 ** 3, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
  if (n >= 1024 ** 2) return `${formatNumber(n / 1024 ** 2, { maximumFractionDigits: 0 })} MB`;
  return `${formatNumber(Math.ceil(n / 1024))} KB`;
};

function UsageRow({ label, current, limit, format = formatNumber }: { label: string; current: number; limit: number | null; format?: (v: number) => string }) {
  useTranslation();
  const pct = limit ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const over = limit !== null && current > limit;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={over ? 'font-medium text-destructive' : 'font-medium'}>
          {format(current)} <span className="text-muted-foreground font-normal">/ {limit === null ? t("별도 한도 없음") : format(limit)}</span>
        </span>
      </div>
      {limit !== null && <Progress value={pct} className="h-1.5" aria-label={t("{{value0}} 사용량 {{value1}}%", { value0: label, value1: pct })} />}
    </div>
  );
}

/** 워크스페이스 사용량과 서버가 적용하는 용량 설정. */
export function PlanUsageCard({ orgId }: { orgId: string; isOwner: boolean }) {
  useTranslation();
  const [billing, setBilling] = useState<OrgBilling | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setBilling(null);
    setError('');
    getOrganizationBilling(orgId)
      .then((b) => {
        if (cancelled) return;
        if (!b) setError(t("사용량 정보를 아직 지원하지 않는 서버입니다. 서버를 최신 버전으로 업데이트하세요."));
        else setBilling(b);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [orgId]);

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t("워크스페이스 사용량")}
          </CardTitle>
          <CardDescription>{t("이 워크스페이스의 사용량과 서버에서 적용하는 용량 설정입니다.")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!billing && !error && <p className="text-sm text-muted-foreground">{t("불러오는 중...")}</p>}
        {billing && (
          <>
            <p className="text-sm text-muted-foreground">
              {billing.enforced ? t("운영자가 설정한 용량 제한이 적용됩니다. 변경이 필요하면 서버 운영자에게 문의하세요.") : t("이 서버는 애플리케이션 용량 제한을 적용하지 않습니다. 실제 용량은 서버 자원에 따라 달라집니다.")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <UsageRow label={t("멤버 (대기 중 초대 포함)")} current={billing.usage.members + billing.usage.pendingInvitations} limit={billing.enforced ? billing.limits.members : null} />
              <UsageRow label={t("프로젝트")} current={billing.usage.projects} limit={billing.enforced ? billing.limits.projects : null} />
              <UsageRow label={t("첨부 파일 용량")} current={billing.usage.attachmentBytes} limit={billing.enforced ? billing.limits.attachmentBytes : null} format={formatBytes} />
              <UsageRow label={t("목표")} current={billing.usage.goals} limit={null} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
