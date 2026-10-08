import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Loader2, Target, CheckCircle2, PauseCircle, TrendingUp, CalendarClock, ArrowRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AppHeader } from '@/components/layout/AppHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { useGoalsQuery } from '@/hooks/useGoalsQuery';
import { useFieldSchema } from '@/hooks/useFieldSchema';
import { useProject } from '@/contexts/ProjectContext';
import { summarize, byStatus, byOwner, byCategory, upcomingDeadlines } from '@/lib/dashboardAggregation';
import { cn } from '@/lib/utils';

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

function Widget({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 flex flex-col', className)}>
      <div className="flex items-start justify-between gap-2 mb-3 min-h-[1.25rem]">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', tone ?? 'bg-primary/10 text-primary')}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function DashboardView() {
  const navigate = useNavigate();
  const { currentProject, includeDescendants, setIncludeDescendants } = useProject() as any;
  const projectId = currentProject?.id ?? null;

  const goalsQuery = useGoalsQuery({ showCompleted: true, showOnHold: true, includeDescendants: !!includeDescendants });
  const schemaQuery = useFieldSchema();
  const goals = goalsQuery.data ?? [];
  const labels = schemaQuery.data?.statusLabels ?? [];

  const stats = useMemo(() => summarize(goals), [goals]);
  const statusData = useMemo(() => byStatus(goals, labels), [goals, labels]);
  const ownerData = useMemo(() => byOwner(goals, 8), [goals]);
  const categoryData = useMemo(() => byCategory(goals), [goals]);
  // 로컬 기준 오늘(YYYY-MM-DD) — toISOString(UTC)은 KST 저녁에 하루 밀릴 수 있음
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const upcoming = useMemo(() => upcomingDeadlines(goals, todayStr, 14), [goals, todayStr]);

  const loading = goalsQuery.isLoading || schemaQuery.isLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* 하위 포함 토글은 ProjectSelector 가 제공(중복 제거) */}
      <AppHeader showTabs />

      <div className="px-4 md:px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !projectId ? (
          <div className="text-center text-muted-foreground py-20">프로젝트를 선택하세요.</div>
        ) : (
          <div className="space-y-4">
            {/* 요약 숫자 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Target} label="총 목표" value={stats.total} />
              <StatCard icon={TrendingUp} label="평균 진행률" value={`${stats.avgProgress}%`} tone="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
              <StatCard icon={CheckCircle2} label="완료" value={stats.completed} tone="bg-green-500/10 text-green-600 dark:text-green-400" />
              <StatCard icon={PauseCircle} label="보류" value={stats.onHold} tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 상태 분포 도넛 */}
              <Widget title="상태 분포">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {statusData.map((d) => <Cell key={d.key} fill={d.color ?? '#9ca3af'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--popover-foreground))' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Widget>

              {/* 담당자 워크로드 — 요약. 상세 인물별 목표는 담당자별 현황으로 드릴다운. */}
              <Widget
                title="담당자별 목표 수"
                subtitle="막대를 클릭하면 담당자별 현황으로 이동합니다"
                action={
                  <Link
                    to="/members"
                    className="text-xs text-primary dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 shrink-0 rounded px-1 py-1 -my-1 -mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    담당자별 현황 <ArrowRight className="h-3 w-3" />
                  </Link>
                }
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ownerData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="label" width={70} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--popover-foreground))' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--primary))"
                      radius={[0, 4, 4, 0]}
                      className="cursor-pointer"
                      activeBar={{ fill: 'hsl(221 83% 45%)' }}
                      onClick={(d: any) => {
                        const name = d?.label ?? d?.payload?.label;
                        if (name) navigate(`/members?owner=${encodeURIComponent(name)}`);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Widget>

              {/* 카테고리 분포 */}
              <Widget title="분류별 목표 수">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={categoryData} margin={{ left: 0, right: 10 }}>
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--popover-foreground))' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Widget>

              {/* 마감 임박 */}
              <Widget title="마감 임박 (14일 이내)">
                {upcoming.length === 0 ? (
                  <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">임박한 마감이 없습니다.</div>
                ) : (
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                    {upcoming.map((g) => (
                      <button key={g.id} onClick={() => navigate(`/?item=${g.id}`)} className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted/50 text-left">
                        <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="flex-1 truncate text-sm">{g.title}</span>
                        <StatusPill label={labels.find((l) => l.id === g.statusId)} size="sm" />
                        <span className="text-xs text-muted-foreground tabular-nums">{g.dueDate}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Widget>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
