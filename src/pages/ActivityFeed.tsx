import { useTranslation, t } from '@/i18n';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  ActivityLog,
  formatRelativeTime,
  groupActivitiesByDate,
  formatActivitySummary,
  ACTION_LABELS,
} from '@/types/activity';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChangeDetails } from '@/components/ChangeDetails';
import {
  ArrowLeft,
  Globe,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  ExternalLink,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarInfo } from '@/components/UserMenu';
import { AppHeader } from '@/components/layout/AppHeader';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATE: <Plus className="h-3 w-3" />,
  UPDATE: <Pencil className="h-3 w-3" />,
  DELETE: <Trash2 className="h-3 w-3" />,
  REORDER: <ArrowUpDown className="h-3 w-3" />,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  REORDER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function ActivityFeed() {
  useTranslation();
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // AI summary state
  const [aiAvailable, setAIAvailable] = useState(false);
  const [aiSummary, setAISummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);

  const loadActivities = async (reset = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const newOffset = reset ? 0 : offset;
      const data = await api.getActivityFeed(
        currentProject?.id,
        limit,
        newOffset
      );

      if (reset) {
        setActivities(data);
        setOffset(limit);
      } else {
        setActivities((prev) => [...prev, ...data]);
        setOffset((prev) => prev + limit);
      }

      setHasMore(data.length === limit);
    } catch (err) {
      setError(t("활동 내역을 불러오는 데 실패했습니다."));
      console.error('Error loading activities:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities(true);
    api.getAIStatus().then((s) => setAIAvailable(s.available)).catch(() => {});
  }, [currentProject?.id]);

  const handleAISummarize = async () => {
    if (activities.length === 0) return;
    setIsSummarizing(true);
    setAISummary('');
    setSummaryOpen(true);
    try {
      const ids = activities.map((a) => a.id);
      await api.summarizeActivityStream(
        ids,
        (chunk) => setAISummary((prev) => (prev || '') + chunk),
      );
    } catch (err: any) {
      setAISummary((prev) => (prev || '') + t("\n\n요약 생성에 실패했습니다: ") + (err.message || ''));
    } finally {
      setIsSummarizing(false);
    }
  };

  const groupedActivities = groupActivitiesByDate(activities);

  const handleGoalClick = (goalId?: string) => {
    if (goalId && goalId !== 'bulk') {
      navigate(`/?goalId=${goalId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={t("활동 내역")}
        subtitle={currentProject?.name}
        backTo="/"
        showProjectSelector={false}
        actions={aiAvailable && activities.length > 0 ? (
          <Button variant="outline" size="sm" onClick={handleAISummarize} disabled={isSummarizing} className="shrink-0">
            {isSummarizing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}{t("AI 요약")}</Button>
        ) : undefined}
      />

      {/* AI Summary */}
      {aiSummary && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg">
            <button
              onClick={() => setSummaryOpen(!summaryOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />{t("AI 활동 요약")}</span>
              {summaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {summaryOpen && (
              <div className="px-4 pb-4 text-sm whitespace-pre-wrap">{aiSummary}</div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {activities.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">{t("활동 내역이 없습니다.")}</div>
        )}

        {Object.entries(groupedActivities).map(([dateLabel, dateActivities]) => (
          <div key={dateLabel} className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground mb-4 sticky top-[73px] bg-background py-2">
              {dateLabel}
            </h2>
            <div className="space-y-3">
              {dateActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onGoalClick={handleGoalClick}
                />
              ))}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {hasMore && !isLoading && activities.length > 0 && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              onClick={() => loadActivities(false)}
            >{t("더 불러오기")}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ActivityCardProps {
  activity: ActivityLog;
  onGoalClick?: (goalId?: string) => void;
}

function ActivityCard({ activity, onGoalClick }: ActivityCardProps) {
  useTranslation();
  const actionColor = ACTION_COLORS[activity.action] || ACTION_COLORS.UPDATE;
  const actionIcon = ACTION_ICONS[activity.action] || ACTION_ICONS.UPDATE;
  const actionLabel = t(ACTION_LABELS[activity.action] || activity.action);

  return (
    <div className="bg-card rounded-lg border p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* User/IP indicator */}
          <ActivityAvatar activity={activity} />

          <div className="min-w-0 flex-1">
            {/* User name and time */}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium truncate">
                {activity.displayName}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatRelativeTime(activity.createdAt)}
              </span>
            </div>

            {/* Activity summary */}
            <p className="text-sm mt-1">
              {formatActivitySummary(activity)}
            </p>

            {/* Change details */}
            <ChangeDetails changes={activity.changes} />

            {/* Action badge */}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className={`text-xs ${actionColor}`}>
                {actionIcon}
                <span className="ml-1">{actionLabel}</span>
              </Badge>
              {activity.entityType && (
                <Badge variant="outline" className="text-xs">
                  {activity.entityType}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action button */}
        {activity.goalId && activity.goalId !== 'bulk' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGoalClick?.(activity.goalId)}
            className="flex-shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ActivityAvatar({ activity }: { activity: ActivityLog }) {
  useTranslation();
  const avatarInfo = getAvatarInfo(activity.user?.picture);

  if (!activity.user) {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <Globe className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  const initials = activity.user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Avatar className="flex-shrink-0 h-8 w-8">
      {(avatarInfo?.type === 'upload' || avatarInfo?.type === 'url') && (
        <AvatarImage src={avatarInfo.url} alt={activity.displayName} />
      )}
      <AvatarFallback
        style={avatarInfo?.type === 'default' ? { backgroundColor: avatarInfo.bg, fontSize: '1rem' } : undefined}
        className="text-xs"
      >
        {avatarInfo?.type === 'default' ? avatarInfo.emoji : initials}
      </AvatarFallback>
    </Avatar>
  );
}
