import { getLocale, t, useTranslation } from '@/i18n';
import { useState, useEffect } from 'react';
import { Goal, SubGoal, GoalCategory, Note, Attachment, Project } from '@/types/goal';
import { ActivityLog, formatRelativeTime, formatActivitySummary } from '@/types/activity';
import { CustomFieldsSection } from '@/components/common/CustomFieldsSection';
import { CommentThread } from '@/components/goal-panel/CommentThread';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Pencil,
  Check,
  Calendar,
  ChevronRight,
  ChevronDown,
  Pin,
  FileText,
  Download,
  Paperclip,
  StickyNote,
  Target,
  History,
  Globe,
  Loader2,
  Copy,
  PauseCircle,
  TrendingUp,
} from 'lucide-react';
import { cn, isKeyResult, computeKrProgress } from '@/lib/utils';
import { LinkifiedText } from '@/components/LinkifiedText';
import { ChangeDetails } from '@/components/ChangeDetails';
import { GoalCopyDialog } from '@/components/GoalCopyDialog';
import { OwnerAvatar, RegisteredUser } from '@/components/OwnerInput';
import { api, CheckIn } from '@/lib/api';

interface GoalViewDialogProps {
  goal: Goal | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onToggleOnHold?: (id: string, onHold: boolean) => void;
  categories: GoalCategory[];
  categoryColors: Record<string, string>;
  registeredUsers?: RegisteredUser[];
  // For copy feature
  projects?: Project[];
  projectTree?: Project[];
  currentProjectId?: string;
  onCopySuccess?: (newGoal: Goal, targetProjectId: string) => void;
}

export const GoalViewDialog = ({
  goal,
  open,
  onClose,
  onEdit,
  onToggleComplete,
  onToggleOnHold,
  categories,
  categoryColors,
  registeredUsers,
  projects = [],
  projectTree = [],
  currentProjectId = '',
  onCopySuccess,
}: GoalViewDialogProps) => {
  useTranslation();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [hasMoreActivities, setHasMoreActivities] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [activityOffset, setActivityOffset] = useState(0);
  const ACTIVITY_LIMIT = 10;

  // Check-in (진행 체크인) state
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isLoadingCheckIns, setIsLoadingCheckIns] = useState(false);
  const [isCheckInsOpen, setIsCheckInsOpen] = useState(false);
  const [checkInsLoaded, setCheckInsLoaded] = useState(false);

  // Reset activity state when dialog closes or goal changes
  useEffect(() => {
    if (!open) {
      setActivities([]);
      setIsActivityOpen(false);
      setHasMoreActivities(false);
      setActivityOffset(0);
      setCheckIns([]);
      setIsCheckInsOpen(false);
      setCheckInsLoaded(false);
    }
  }, [open, goal?.id]);

  // Load activities when collapsible opens (lazy loading)
  const handleActivityOpenChange = (isOpen: boolean) => {
    setIsActivityOpen(isOpen);
    if (isOpen && activities.length === 0 && goal?.id) {
      loadActivities(true);
    }
  };

  const loadActivities = async (reset: boolean = false) => {
    if (!goal?.id || isLoadingActivities) return;

    setIsLoadingActivities(true);
    try {
      const offset = reset ? 0 : activityOffset;
      const data = await api.getGoalActivity(goal.id, ACTIVITY_LIMIT, offset);

      if (reset) {
        setActivities(data);
        setActivityOffset(ACTIVITY_LIMIT);
      } else {
        setActivities(prev => [...prev, ...data]);
        setActivityOffset(prev => prev + ACTIVITY_LIMIT);
      }
      setHasMoreActivities(data.length === ACTIVITY_LIMIT);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  // Load check-ins when collapsible opens (lazy loading)
  const handleCheckInsOpenChange = (isOpen: boolean) => {
    setIsCheckInsOpen(isOpen);
    if (isOpen && !checkInsLoaded && goal?.id) {
      loadCheckIns();
    }
  };

  const loadCheckIns = async () => {
    if (!goal?.id || isLoadingCheckIns) return;

    setIsLoadingCheckIns(true);
    try {
      const data = await api.getCheckIns(goal.id);
      setCheckIns(data);
      setCheckInsLoaded(true);
    } catch (error) {
      console.error('Error loading check-ins:', error);
    } finally {
      setIsLoadingCheckIns(false);
    }
  };

  if (!goal) return null;

  const formatCheckInDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const sizeLabels: Record<string, string> = {
    xs: t("최저"),
    small: t("낮음"),
    medium: t("중간"),
    large: t("높음"),
    xl: t("최고"),
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: 'short',
    });
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = (attachmentId: string) => {
    api.downloadAttachment(attachmentId);
  };

  const hasSubGoals = goal.subGoals && goal.subGoals.length > 0;
  const hasNotes = goal.notes && goal.notes.length > 0;
  const hasAttachments = goal.attachments && goal.attachments.length > 0;

  // Sort notes: pinned first, then by date
  const sortedNotes = goal.notes
    ? [...goal.notes].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : [];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b bg-background sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <SheetTitle className="sr-only">{t("목표 상세 보기")}</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex gap-2">
              <Button
                variant={goal.completed ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => onToggleComplete(goal.id, !goal.completed)}
                className={cn(
                  goal.completed && 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                )}
              >
                <Check className="h-4 w-4 mr-1" />
                {goal.completed ? t("완료됨") : t("완료")}
              </Button>
              {onToggleOnHold && (
                <Button
                  variant={goal.onHold ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => onToggleOnHold(goal.id, !goal.onHold)}
                  className={cn(
                    goal.onHold && 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                  )}
                >
                  <PauseCircle className="h-4 w-4 mr-1" />
                  {goal.onHold ? t("보류됨") : t("보류")}
                </Button>
              )}
              <Button size="sm" onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-1" />
                {t("편집")}
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Title & Meta Section */}
          <div className="space-y-3">
            {/* Categories & Priority */}
            <div className="flex flex-wrap gap-2">
              {goal.categories?.map((category) => (
                <Badge
                  key={category}
                  style={{
                    backgroundColor: categoryColors[category] || '#6b7280',
                    color: '#ffffff',
                  }}
                >
                  {category}
                </Badge>
              ))}
              <Badge variant="outline" className="text-muted-foreground">
                {t("중요도:")} {sizeLabels[goal.size] || goal.size}
              </Badge>
            </div>

            {/* Title */}
            <h2 className={cn(
              "text-2xl font-bold",
              goal.completed && "text-muted-foreground line-through",
              goal.onHold && "text-amber-600/70"
            )}>
              {goal.title}
            </h2>

            {/* Owner & Date */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                {(goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner]).map((name, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1">
                    <OwnerAvatar ownerName={name} registeredUsers={registeredUsers} size="md" />
                    <span>{name}</span>
                    {idx < (goal.owners?.length || 1) - 1 && <span>,</span>}
                  </span>
                ))}
              </div>
              {(goal.startDate || goal.dueDate) && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDate(goal.startDate)}
                    {goal.startDate && goal.dueDate && ' ~ '}
                    {formatDate(goal.dueDate)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Progress Section */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("진행률")}</span>
              <span className="text-lg font-bold text-primary">{goal.progress}%</span>
            </div>
            <Progress value={goal.progress} className="h-2" />
            {goal.statusNote && (
              <div className="mt-3 p-3 bg-background rounded-md border text-sm italic text-muted-foreground whitespace-pre-wrap">
                "<LinkifiedText text={goal.statusNote} />"
              </div>
            )}
          </div>

          {/* Check-in History Section - Lazy Loading */}
          <Collapsible open={isCheckInsOpen} onOpenChange={handleCheckInsOpenChange}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg border hover:bg-muted/50 transition-colors group">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {t("진행 체크인")}
                </h3>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {isLoadingCheckIns && checkIns.length === 0 ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : checkIns.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  {t("진행 체크인 기록이 없습니다.")}
                </div>
              ) : (
                checkIns.map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border"
                  >
                    <span className="flex-shrink-0 text-sm font-bold text-primary w-12 text-right">
                      {checkIn.progress}%
                    </span>
                    <div className="flex-1 min-w-0">
                      {checkIn.note && (
                        <p className="text-sm whitespace-pre-wrap">
                          <LinkifiedText text={checkIn.note} />
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {checkIn.user?.name ? `${checkIn.user.name} · ` : ''}
                        {formatCheckInDate(checkIn.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Description Section */}
          {goal.description && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t("설명")}
              </h3>
              <div className="text-sm leading-relaxed">
                <LinkifiedText text={goal.description} />
              </div>
            </div>
          )}

          {/* Custom Fields Section — 커스텀 필드가 테이블 밖에서도 보이도록(개요 탭) */}
          <CustomFieldsSection customFields={goal.customFields} />

          {/* SubGoals Section */}
          {hasSubGoals && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t("하위 목표 (")}{goal.subGoals!.length})
              </h3>
              <div className="space-y-2">
                {goal.subGoals!.map((subGoal, index) => (
                  <SubGoalCard key={subGoal.id} subGoal={subGoal} index={index} registeredUsers={registeredUsers} />
                ))}
              </div>
            </div>
          )}

          {/* Notes Section */}
          {hasNotes && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <StickyNote className="h-4 w-4" />
                {t("메모 (")}{goal.notes!.length})
              </h3>
              <div className="space-y-2">
                {sortedNotes.map((note) => (
                  <NoteCard key={note.id} note={note} formatFullDate={formatFullDate} />
                ))}
              </div>
            </div>
          )}

          {/* Attachments Section */}
          {hasAttachments && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                {t("첨부파일 (")}{goal.attachments!.length})
              </h3>
              <div className="space-y-2">
                {goal.attachments!.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {attachment.originalName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDownload(attachment.id)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                      title={t("다운로드")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments (협업 스레드) — 메모(고정)와 별개의 저자 서명 대화 + @멘션 */}
          <div className="border-t pt-4">
            <CommentThread goalId={goal.id} />
          </div>

          {/* Activity History Section - Lazy Loading */}
          <Collapsible open={isActivityOpen} onOpenChange={handleActivityOpenChange}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg border hover:bg-muted/50 transition-colors group">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <History className="h-4 w-4" />
                  {t("변경 이력 보기")}
                </h3>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {isLoadingActivities && activities.length === 0 ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  {t("변경 이력이 없습니다.")}
                </div>
              ) : (
                <>
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        {activity.user?.picture ? (
                          <img
                            src={activity.user.picture}
                            alt={activity.displayName}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <Globe className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          {formatActivitySummary(activity)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.displayName} · {formatRelativeTime(activity.createdAt)}
                        </p>
                        <ChangeDetails changes={activity.changes} />
                      </div>
                    </div>
                  ))}
                  {hasMoreActivities && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => loadActivities(false)}
                      disabled={isLoadingActivities}
                    >
                      {isLoadingActivities ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {t("더 보기")}
                    </Button>
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Footer */}
        <SheetFooter className="px-6 py-4 border-t bg-background">
          <div className="flex justify-between w-full">
            <div>
              {projects.length > 1 && onCopySuccess && (
                <Button
                  variant="outline"
                  onClick={() => setIsCopyDialogOpen(true)}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {t("복사")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                {t("닫기")}
              </Button>
              <Button onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-1" />
                {t("편집")}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>

      {/* Copy Dialog */}
      <GoalCopyDialog
        goal={goal}
        open={isCopyDialogOpen}
        onClose={() => setIsCopyDialogOpen(false)}
        projects={projects}
        projectTree={projectTree}
        currentProjectId={currentProjectId}
        onSuccess={(newGoal, targetProjectId) => {
          onCopySuccess?.(newGoal, targetProjectId);
        }}
      />
    </Sheet>
  );
};

// SubGoal Card Component
const SubGoalCard = ({ subGoal, index, registeredUsers }: { subGoal: SubGoal; index: number; registeredUsers?: RegisteredUser[] }) => {
  useTranslation();
  const isKr = isKeyResult(subGoal);
  const displayProgress = isKr ? computeKrProgress(subGoal) : subGoal.progress;
  return (
    <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{subGoal.title}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {(subGoal.owners && subGoal.owners.length > 0 ? subGoal.owners : [subGoal.owner]).map((name, idx) => (
                <span key={idx} className="inline-flex items-center gap-0.5">
                  <OwnerAvatar ownerName={name} registeredUsers={registeredUsers} size="sm" />
                  {name}
                  {idx < ((subGoal.owners?.length || 1) - 1) && <span>,</span>}
                </span>
              ))}
            </span>
            {(subGoal.startDate || subGoal.dueDate) && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {subGoal.startDate && subGoal.startDate}
                {subGoal.startDate && subGoal.dueDate && ' ~ '}
                {subGoal.dueDate && subGoal.dueDate}
              </span>
            )}
          </div>
        </div>
      </div>
      {isKr && (
        <p className="text-xs text-muted-foreground pl-7">
          {subGoal.currentValue ?? 0}/{subGoal.targetValue}
          {subGoal.unit ? ` ${subGoal.unit}` : ''}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Progress value={displayProgress} className="h-1.5 flex-1" />
        <span className="text-xs font-medium text-muted-foreground w-8 text-right">
          {displayProgress}%
        </span>
      </div>
      {subGoal.statusNote && (
        <p className="text-xs text-muted-foreground italic pl-7 whitespace-pre-wrap">
          "<LinkifiedText text={subGoal.statusNote} />"
        </p>
      )}
    </div>
  );
};

// Note Card Component
const NoteCard = ({
  note,
  formatFullDate,
}: {
  note: Note;
  formatFullDate: (date: string) => string;
}) => {
  useTranslation();
  return (
    <div
      className={cn(
        'p-3 rounded-lg border',
        note.isPinned
          ? 'bg-primary/5 border-primary/20'
          : 'bg-muted/50 border-border'
      )}
    >
      <div className="flex items-start gap-2">
        {note.isPinned && (
          <Pin className="h-3.5 w-3.5 text-primary fill-primary flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <LinkifiedText text={note.content} />
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {note.updatedAt
              ? t("수정됨: {{value0}}", { value0: formatFullDate(note.updatedAt) })
              : formatFullDate(note.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
};

