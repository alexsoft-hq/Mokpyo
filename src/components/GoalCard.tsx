import { getLocale, t, useTranslation } from '@/i18n';
import { Goal, GoalCategory, GoalSize } from '@/types/goal';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, GripVertical, StickyNote, CheckCircle2, Circle, Paperclip, PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LinkifiedText } from '@/components/LinkifiedText';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PriorityIcon } from '@/components/PriorityIcon';
import { CategoryQuickEditor } from '@/components/CategoryQuickEditor';
import { OwnerAvatar, RegisteredUser } from '@/components/OwnerInput';

interface GoalCardProps {
  goal: Goal;
  onClick: () => void;
  categories?: GoalCategory[];
  categoryColors?: Record<string, string>;
  onToggleComplete?: (goalId: string, completed: boolean) => void;
  onToggleOnHold?: (goalId: string, onHold: boolean) => void;
  onUpdateCategories?: (goalId: string, categories: GoalCategory[]) => Promise<void>;
  onAddCategory?: (name: string) => Promise<void>;
  onUpdateCategoryColor?: (category: string, color: string) => Promise<void>;
  onUpdateCategoryName?: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory?: (category: string) => Promise<void>;
  categoryUsageCount?: Record<string, number>;
  registeredUsers?: RegisteredUser[];
}

const getCategoryStyle = (category: GoalCategory, categoryColors?: Record<string, string>) => {
  const color = categoryColors?.[category];
  if (!color) {
    // Fallback to default styles if no custom color
    switch (category) {
      case 'SERVICE':
        return { className: 'goal-card-service', badgeClassName: 'badge-service' };
      case 'AI':
        return { className: 'goal-card-ai', badgeClassName: 'badge-ai' };
      case 'OPERATIONS':
        return { className: 'goal-card-operations', badgeClassName: 'badge-operations' };
      default:
        return { className: 'goal-card-service', badgeClassName: 'badge-service' };
    }
  }
  
  return {
    style: {
      backgroundColor: `${color}10`,
      borderColor: `${color}60`,
    },
    badgeStyle: {
      backgroundColor: color,
      color: '#ffffff',
    },
  };
};

const getSizeClass = (size: GoalSize) => {
  switch (size) {
    case 'xs':
      return 'md:col-span-1 md:row-span-1';
    case 'small':
      return 'md:col-span-1 md:row-span-1';
    case 'medium':
      return 'md:col-span-1 md:row-span-2';
    case 'large':
      return 'md:col-span-2 md:row-span-2';
    case 'xl':
      return 'md:col-span-2 md:row-span-3';
    default:
      return 'md:col-span-1 md:row-span-1'; // fallback
  }
};


export const GoalCard = ({ goal, onClick, categories = [], categoryColors, onToggleComplete, onToggleOnHold, onUpdateCategories, onAddCategory, onUpdateCategoryColor, onUpdateCategoryName, onDeleteCategory, categoryUsageCount, registeredUsers }: GoalCardProps) => {
  useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // Use first category for card styling
  const primaryCategory = goal.categories && goal.categories.length > 0 ? goal.categories[0] : 'SERVICE';
  const categoryStyle = getCategoryStyle(primaryCategory as GoalCategory, categoryColors);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...categoryStyle.style }}
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 p-6 cursor-pointer transition-all duration-300',
        'hover:shadow-xl hover:-translate-y-1 animate-fade-in relative',
        categoryStyle.className,
        getSizeClass(goal.size),
        isDragging && 'opacity-50 z-50',
        goal.completed && 'opacity-60 saturate-50',
        goal.onHold && 'opacity-60 saturate-75'
      )}
    >
      {/* 상단 헤더: 담당자, 첨부파일, 완료, 드래그 */}
      <div className="flex flex-col items-stretch gap-2 mb-3">
        <div className="flex items-center gap-3 text-sm text-foreground/70 flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            {(goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner]).map((name, idx) => (
              <span key={idx} className={cn('flex items-center gap-0.5', idx === 0 ? 'min-w-0' : 'shrink-0')}>
                <OwnerAvatar ownerName={name} registeredUsers={registeredUsers} size="sm" />
                {idx === 0 && <span className="font-medium truncate whitespace-nowrap" title={name}>{name}</span>}
              </span>
            ))}
            {goal.owners && goal.owners.length > 1 && (
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{t("외 {{count}}명", { count: goal.owners.length - 1 })}</span>
            )}
          </div>
          {goal.attachments && goal.attachments.length > 0 && (
            <div className="flex items-center gap-1 text-primary">
              <Paperclip className="w-4 h-4" />
              <span className="font-medium">{goal.attachments.length}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center justify-end flex-shrink-0">
          {onToggleComplete && (
            <button
                  aria-pressed={!!goal.completed}
                  aria-label={goal.completed ? t("완료 취소") : t("완료로 표시")}
                  title={goal.completed ? t("완료 취소") : t("완료로 표시")}
              onClick={(e) => {
                e.stopPropagation();
                onToggleComplete(goal.id, !goal.completed);
              }}
              className={cn(
                "group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
                "transition-all duration-300 ease-out",
                "hover:shadow-md hover:scale-105",
                "border-2",
                goal.completed
                  ? "bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 text-white shadow-green-200/50 shadow-lg"
                  : "bg-background/95 backdrop-blur-sm border-border hover:border-green-400 hover:bg-green-50/50"
              )}
            >
              {goal.completed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 animate-in zoom-in duration-300" />
                  <span className="text-xs font-semibold">{t("완료")}</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 text-muted-foreground group-hover:text-green-500 transition-colors" />
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-green-600 transition-colors">{t("완료")}</span>
                </>
              )}
            </button>
          )}
          {onToggleOnHold && (
            <button
                  aria-pressed={!!goal.onHold}
                  aria-label={goal.onHold ? t("보류 해제") : t("보류로 표시")}
                  title={goal.onHold ? t("보류 해제") : t("보류로 표시")}
              onClick={(e) => {
                e.stopPropagation();
                onToggleOnHold(goal.id, !goal.onHold);
              }}
              className={cn(
                "group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
                "transition-all duration-300 ease-out",
                "hover:shadow-md hover:scale-105",
                "border-2",
                goal.onHold
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400 text-white shadow-amber-200/50 shadow-lg"
                  : "bg-background/95 backdrop-blur-sm border-border hover:border-amber-400 hover:bg-amber-50/50"
              )}
            >
              {goal.onHold ? (
                <>
                  <PauseCircle className="w-4 h-4 animate-in zoom-in duration-300" />
                  <span className="text-xs font-semibold">{t("보류")}</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-amber-600 transition-colors">{t("보류")}</span>
                </>
              )}
            </button>
          )}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-foreground/10 rounded transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-5 h-5 text-foreground/40" />
          </div>
        </div>
      </div>
      <div className="mb-3">
        <div className="flex gap-2 flex-wrap items-center">
          {goal.categories && goal.categories.map((category, index) => {
            const catStyle = getCategoryStyle(category as GoalCategory, categoryColors);
            return (
              <Badge
                key={index}
                style={catStyle.badgeStyle}
                className={cn('text-xs font-semibold', catStyle.badgeClassName)}
              >
                {category}
              </Badge>
            );
          })}
          {onUpdateCategories && (
            <CategoryQuickEditor
              goal={goal}
              categories={categories}
              categoryColors={categoryColors || {}}
              onUpdateCategories={onUpdateCategories}
              onAddCategory={onAddCategory}
              onUpdateCategoryColor={onUpdateCategoryColor}
              onUpdateCategoryName={onUpdateCategoryName}
              onDeleteCategory={onDeleteCategory}
              categoryUsageCount={categoryUsageCount}
              size="md"
            />
          )}
          <PriorityIcon size={goal.size} showLabel />
        </div>
      </div>

      <h3 className="text-xl font-bold mb-2 line-clamp-2">{goal.title}</h3>

      {goal.description && (
        <p className="text-sm text-foreground/70 mb-4 line-clamp-2">
          <LinkifiedText text={goal.description} />
        </p>
      )}

      <div className="space-y-3 mb-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {t("진행률")}
            </span>
            <span className="text-lg font-bold">{goal.progress}%</span>
          </div>
          <Progress value={goal.progress} className="h-2" />
        </div>

        {(goal.startDate || goal.dueDate) && (
          <div className="flex items-center gap-2 text-xs text-foreground/60">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {formatDate(goal.startDate)} ~ {formatDate(goal.dueDate)}
            </span>
          </div>
        )}

        {goal.statusNote && (
          <div className="text-sm">
            <span className="font-medium">{t("상태:")} </span>
            <span className="text-foreground/70">
              <LinkifiedText text={goal.statusNote} />
            </span>
          </div>
        )}
      </div>

      {goal.notes && goal.notes.some(note => note.isPinned) && (
        <div className="pt-4 border-t border-foreground/10">
          <div className="flex items-center gap-2 mb-2">
            <StickyNote className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">{t("중요 메모")}</p>
          </div>
          <div className="space-y-2">
            {goal.notes
              .filter(note => note.isPinned)
              .slice(0, 2)
              .map((note) => (
                <div key={note.id} className="p-2 bg-primary/10 rounded-md border border-primary/20">
                  <p className="text-xs text-foreground/80 line-clamp-2">
                    <LinkifiedText text={note.content} />
                  </p>
                  <p className="text-[10px] text-foreground/50 mt-1">
                    {note.updatedAt
                      ? t("수정: {{value0}}", { value0: formatDate(note.updatedAt) })
                      : formatDate(note.createdAt)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {goal.subGoals && goal.subGoals.length > 0 && (
        <div className="pt-4 border-t border-foreground/10">
          <p className="text-sm font-semibold mb-2">
            {t("하위 목표 {{count}}개", { count: goal.subGoals.length })}
          </p>
          <div className="space-y-2">
            {goal.subGoals.slice(0, 3).map((subGoal) => (
              <div key={subGoal.id} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium line-clamp-1">{subGoal.title}</span>
                  <span className="text-xs font-semibold ml-2">{subGoal.progress}%</span>
                </div>
                <Progress value={subGoal.progress} className="h-1" />
                {(subGoal.startDate || subGoal.dueDate) && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="w-2.5 h-2.5" />
                    {subGoal.startDate && subGoal.startDate}
                    {subGoal.startDate && subGoal.dueDate && ' ~ '}
                    {subGoal.dueDate && subGoal.dueDate}
                  </div>
                )}
              </div>
            ))}
            {goal.subGoals.length > 3 && (
              <p className="text-xs text-primary font-medium">
                {t("{{count}}개 더보기", { count: goal.subGoals.length - 3 })}
              </p>
            )}
          </div>
        </div>
      )}

      {goal.attachments && goal.attachments.length > 0 && (
        <div className="pt-4 border-t border-foreground/10">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">
              {t("첨부파일 {{count}}개", { count: goal.attachments.length })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
