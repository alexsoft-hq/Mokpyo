import { t, useTranslation } from '@/i18n';
import { useState, useMemo, useCallback } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type MemberData, getProgressColor } from '@/lib/memberData';
import {
  LayoutGrid,
  TreePine,
  User,
  Users,
  Target,
  CheckCircle2,
  PauseCircle,
  TrendingUp,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';

type DashboardTab = 'cards' | 'treemap';

interface MemberDashboardProps {
  members: MemberData[];
  onOpenDetail: (goalId: string, subGoalId?: string) => void;
}

// Progress-based color for treemap cells
function progressToColor(progress: number): string {
  if (progress >= 80) return '#22c55e'; // green-500
  if (progress >= 60) return '#84cc16'; // lime-500
  if (progress >= 40) return '#eab308'; // yellow-500
  if (progress >= 20) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

function progressToBgClass(progress: number): string {
  if (progress >= 80) return 'bg-green-500';
  if (progress >= 60) return 'bg-lime-500';
  if (progress >= 40) return 'bg-yellow-500';
  if (progress >= 20) return 'bg-orange-500';
  return 'bg-red-500';
}

// Custom treemap cell content
function TreemapCell(props: any) {
  useTranslation();
  const { x, y, width, height, name, avgProgress, totalCount } = props;
  if (!name || width < 30 || height < 20) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        fill={progressToColor(avgProgress)}
        stroke="#fff"
        strokeWidth={2}
        className="cursor-pointer transition-opacity hover:opacity-80"
      />
      {width > 50 && height > 30 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - (height > 50 ? 8 : 0)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={Math.min(14, width / name.length * 1.5)}
            fontWeight="600"
          >
            {name}
          </text>
          {height > 50 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 14}
              textAnchor="middle"
              dominantBaseline="central"
              fill="rgba(255,255,255,0.85)"
              fontSize={11}
            >
              {t("진행률 {{progress}}% · 목표 {{count}}건", { progress: avgProgress, count: totalCount })}
            </text>
          )}
        </>
      )}
    </g>
  );
}

// Custom tooltip for treemap
function TreemapTooltipContent({ active, payload }: any) {
  useTranslation();
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md text-sm">
      <p className="font-semibold">{data.name}</p>
      <p className="text-muted-foreground">
        {t("목표 {{count}}건 · 진행률 {{progress}}%", { count: data.totalCount, progress: data.avgProgress })}
      </p>
      <p className="text-muted-foreground">
        {t("완료")} {data.completedCount} {t("· 보류")} {data.onHoldCount}
      </p>
    </div>
  );
}

export function MemberDashboard({ members, onOpenDetail }: MemberDashboardProps) {
  useTranslation();
  const [tab, setTab] = useState<DashboardTab>('cards');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // Global summary stats
  const summary = useMemo(() => {
    const totalMembers = members.length;
    const totalGoals = members.reduce((s, m) => s + m.totalCount, 0);
    const totalCompleted = members.reduce((s, m) => s + m.completedCount, 0);
    const totalOnHold = members.reduce((s, m) => s + m.onHoldCount, 0);
    const avgProgress = totalMembers > 0
      ? Math.round(members.reduce((s, m) => s + m.avgProgress, 0) / totalMembers)
      : 0;
    return { totalMembers, totalGoals, totalCompleted, totalOnHold, avgProgress };
  }, [members]);

  // Treemap data
  const treemapData = useMemo(() =>
    members.map(m => ({
      name: m.name,
      size: Math.max(m.totalCount, 1),
      avgProgress: m.avgProgress,
      totalCount: m.totalCount,
      completedCount: m.completedCount,
      onHoldCount: m.onHoldCount,
    })),
    [members]
  );

  const drilldownMember = useMemo(() =>
    selectedMember ? members.find(m => m.name === selectedMember) : null,
    [members, selectedMember]
  );

  const handleMemberClick = useCallback((name: string) => {
    setSelectedMember(name);
  }, []);

  const handleTreemapClick = useCallback((data: any) => {
    if (data?.name) setSelectedMember(data.name);
  }, []);

  // Drilldown view
  if (drilldownMember) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("전체 현황")}
          </Button>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold">{drilldownMember.name}</h2>
            <Badge variant="outline" className="text-xs">
              {t("{{count}}건", { count: drilldownMember.totalCount })}
            </Badge>
          </div>
        </div>

        {/* Member stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label={t("전체")} value={drilldownMember.totalCount} icon={<Target className="h-4 w-4" />} />
          <StatCard label={t("진행률")} value={`${drilldownMember.avgProgress}%`} icon={<TrendingUp className="h-4 w-4" />} color={getProgressColor(drilldownMember.avgProgress)} />
          <StatCard label={t("완료")} value={drilldownMember.completedCount} icon={<CheckCircle2 className="h-4 w-4" />} color="text-green-600" />
          <StatCard label={t("보류")} value={drilldownMember.onHoldCount} icon={<PauseCircle className="h-4 w-4" />} color="text-amber-600" />
        </div>

        <Progress value={drilldownMember.avgProgress} className="h-2" />

        {/* Goals list */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("담당 목표")}</h3>
          {drilldownMember.goals.map(goal => (
            <button
              key={goal.id}
              onClick={() => onOpenDetail(goal.id)}
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{goal.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {goal.completed && <Badge className="bg-green-100 text-green-700 text-[10px]">{t("완료")}</Badge>}
                  {goal.onHold && <Badge className="bg-amber-100 text-amber-700 text-[10px]">{t("보류")}</Badge>}
                  <span className={cn('text-sm font-semibold', getProgressColor(goal.progress))}>{goal.progress}%</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              {goal.subGoals && goal.subGoals.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  {t("하위 목표 {{count}}개", { count: goal.subGoals.length })}
                </p>
              )}
            </button>
          ))}

          {drilldownMember.subGoals.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-muted-foreground mt-4">{t("담당 하위목표")}</h3>
              {drilldownMember.subGoals.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => onOpenDetail(sub.parentGoalId, sub.id)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate">↳ {sub.title}</span>
                      <p className="text-xs text-muted-foreground">{sub.parentGoalTitle}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('text-sm font-semibold', getProgressColor(sub.progress))}>{sub.progress}%</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  // Dashboard overview
  return (
    <div className="space-y-6">
      {/* Global summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label={t("담당자")} value={summary.totalMembers} icon={<Users className="h-4 w-4" />} />
        <StatCard label={t("전체 목표")} value={summary.totalGoals} icon={<Target className="h-4 w-4" />} />
        <StatCard label={t("평균 진행률")} value={`${summary.avgProgress}%`} icon={<TrendingUp className="h-4 w-4" />} color={getProgressColor(summary.avgProgress)} />
        <StatCard label={t("완료")} value={summary.totalCompleted} icon={<CheckCircle2 className="h-4 w-4" />} color="text-green-600" />
        <StatCard label={t("보류")} value={summary.totalOnHold} icon={<PauseCircle className="h-4 w-4" />} color="text-amber-600" />
      </div>

      {/* Tab toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        <Button
          variant={tab === 'cards' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setTab('cards')}
          className="text-xs h-7 px-3"
        >
          <LayoutGrid className="h-3.5 w-3.5 mr-1" />
          {t("카드")}
        </Button>
        <Button
          variant={tab === 'treemap' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setTab('treemap')}
          className="text-xs h-7 px-3"
        >
          <TreePine className="h-3.5 w-3.5 mr-1" />
          {t("트리맵")}
        </Button>
      </div>

      {/* Cards tab */}
      {tab === 'cards' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {members.map(member => (
            <button
              key={member.name}
              onClick={() => handleMemberClick(member.name)}
              className="text-left p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{member.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t("목표 {{count}}건", { count: member.totalCount })}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("진행률")}</span>
                  <span className={cn('font-semibold', getProgressColor(member.avgProgress))}>
                    {member.avgProgress}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', progressToBgClass(member.avgProgress))}
                    style={{ width: `${member.avgProgress}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {member.completedCount > 0 && (
                    <span className="flex items-center gap-0.5 text-green-600">
                      <CheckCircle2 className="h-3 w-3" /> {member.completedCount}
                    </span>
                  )}
                  {member.onHoldCount > 0 && (
                    <span className="flex items-center gap-0.5 text-amber-600">
                      <PauseCircle className="h-3 w-3" /> {member.onHoldCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Treemap tab */}
      {tab === 'treemap' && (
        <div className="border rounded-xl p-4 bg-card">
          <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
            <span>{t("크기 = 목표 수")}</span>
            <span className="flex items-center gap-1">
              {t("색상:")}
              <span className="inline-block w-3 h-3 rounded bg-red-500" />{t("낮음")}
              <span className="inline-block w-3 h-3 rounded bg-yellow-500" />{t("중간")}
              <span className="inline-block w-3 h-3 rounded bg-green-500" />{t("높음")}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(300, members.length * 30)}>
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              content={<TreemapCell />}
              onClick={handleTreemapClick}
              isAnimationActive={false}
            >
              <Tooltip content={<TreemapTooltipContent />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Small stat card
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
  useTranslation();
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <p className={cn('text-xl font-bold', color)}>{value}</p>
    </div>
  );
}
