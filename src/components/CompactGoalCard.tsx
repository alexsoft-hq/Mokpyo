import { getLocale, t, useTranslation } from '@/i18n';
import { Goal, GoalCategory, GoalSize } from '@/types/goal';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, GripVertical, StickyNote, CheckCircle2, Circle, Paperclip, Download, PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LinkifiedText } from '@/components/LinkifiedText';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/lib/api';
// import { useState, useEffect } from 'react';
// import {
//   HoverCard,
//   HoverCardContent,
//   HoverCardTrigger,
// } from "@/components/ui/hover-card";
import { PriorityIcon } from '@/components/PriorityIcon';
import { CategoryQuickEditor } from '@/components/CategoryQuickEditor';
import { OwnerAvatar, RegisteredUser } from '@/components/OwnerInput';

interface CompactGoalCardProps {
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

export const CompactGoalCard = ({ goal, onClick, categories = [], categoryColors, onToggleComplete, onToggleOnHold, onUpdateCategories, onAddCategory, onUpdateCategoryColor, onUpdateCategoryName, onDeleteCategory, categoryUsageCount, registeredUsers }: CompactGoalCardProps) => {
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

  // // Track dark mode changes to re-render hover card background
  // const [isDarkMode, setIsDarkMode] = useState(
  //   document.documentElement.classList.contains('dark')
  // );

  // useEffect(() => {
  //   // Watch for theme changes on document.documentElement
  //   const observer = new MutationObserver((mutations) => {
  //     mutations.forEach((mutation) => {
  //       if (mutation.attributeName === 'class') {
  //         setIsDarkMode(document.documentElement.classList.contains('dark'));
  //       }
  //     });
  //   });

  //   observer.observe(document.documentElement, {
  //     attributes: true,
  //     attributeFilter: ['class'],
  //   });

  //   return () => observer.disconnect();
  // }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(getLocale(), {
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatFullDate = (dateStr?: string) => {
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

  // // Calculate hover card background color based on current theme
  // const getHoverCardBackground = () => {
  //   if (!categoryColors?.[primaryCategory]) {
  //     return 'var(--card)';
  //   }

  //   const hexColor = categoryColors[primaryCategory];
  //   const hex = hexColor.replace('#', '');
  //   const r = parseInt(hex.substring(0, 2), 16);
  //   const g = parseInt(hex.substring(2, 4), 16);
  //   const b = parseInt(hex.substring(4, 6), 16);

  //   const opacity = 0.06;
  //   const baseR = isDarkMode ? 0 : 255;
  //   const baseG = isDarkMode ? 0 : 255;
  //   const baseB = isDarkMode ? 0 : 255;

  //   const blendedR = Math.round(r * opacity + baseR * (1 - opacity));
  //   const blendedG = Math.round(g * opacity + baseG * (1 - opacity));
  //   const blendedB = Math.round(b * opacity + baseB * (1 - opacity));

  //   const toHex = (n: number) => n.toString(16).padStart(2, '0');
  //   return `#${toHex(blendedR)}${toHex(blendedG)}${toHex(blendedB)}`;
  // };

  return (
        <div
          ref={setNodeRef}
          style={{ ...style, ...categoryStyle.style }}
          className={cn(
            'rounded-lg border-2 p-3 cursor-pointer transition-all duration-300',
            'hover:shadow-lg hover:-translate-y-0.5 animate-fade-in relative',
            categoryStyle.className,
            isDragging && 'opacity-50 z-50',
            goal.completed && 'opacity-60 saturate-50',
            goal.onHold && 'opacity-60 saturate-75'
          )}
        >
          {/* 상단 헤더: 담당자, 첨부파일, 완료, 드래그 */}
          <div className="flex flex-col items-stretch gap-2 mb-2">
            <div className="flex items-center gap-3 text-xs text-foreground/70 flex-1 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                {(goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner]).slice(0, 1).map((name, idx) => (
                  <span key={idx} className="flex items-center gap-0.5 min-w-0">
                    <OwnerAvatar ownerName={name} registeredUsers={registeredUsers} size="sm" />
                    <span className="font-medium truncate whitespace-nowrap" title={name}>{name}</span>
                  </span>
                ))}
                {goal.owners && goal.owners.length > 1 && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{t("외 {{count}}명", { count: goal.owners.length - 1 })}</span>
                )}
              </div>
              {goal.attachments && goal.attachments.length > 0 && (
                <div className="flex items-center gap-1 text-primary">
                  <Paperclip className="w-3 h-3" />
                  <span className="font-medium">{goal.attachments.length}</span>
                </div>
              )}
            </div>
            <div className="flex gap-1 items-center justify-end flex-shrink-0">
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
                    "group relative flex items-center gap-1 px-1.5 py-1 rounded-md",
                    "transition-all duration-300 ease-out",
                    "hover:shadow-md hover:scale-105",
                    "border",
                    goal.completed
                      ? "bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 text-white shadow-green-200/50 shadow-md"
                      : "bg-background/95 backdrop-blur-sm border-border hover:border-green-400 hover:bg-green-50/50"
                  )}
                >
                  {goal.completed ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 animate-in zoom-in duration-300" />
                      <span className="text-[10px] font-semibold">{t("완료")}</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-3 h-3 text-muted-foreground group-hover:text-green-500 transition-colors" />
                      <span className="text-[10px] font-medium text-muted-foreground group-hover:text-green-600 transition-colors">{t("완료")}</span>
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
                    "group relative flex items-center gap-1 px-1.5 py-1 rounded-md",
                    "transition-all duration-300 ease-out",
                    "hover:shadow-md hover:scale-105",
                    "border",
                    goal.onHold
                      ? "bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400 text-white shadow-amber-200/50 shadow-md"
                      : "bg-background/95 backdrop-blur-sm border-border hover:border-amber-400 hover:bg-amber-50/50"
                  )}
                >
                  {goal.onHold ? (
                    <>
                      <PauseCircle className="w-3 h-3 animate-in zoom-in duration-300" />
                      <span className="text-[10px] font-semibold">{t("보류")}</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3 h-3 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                      <span className="text-[10px] font-medium text-muted-foreground group-hover:text-amber-600 transition-colors">{t("보류")}</span>
                    </>
                  )}
                </button>
              )}
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-foreground/10 rounded transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4 text-foreground/40" />
              </div>
            </div>
          </div>
          <div onClick={onClick}>
        <div className="mb-2">
          <div className="flex gap-1 flex-wrap items-center">
            <PriorityIcon size={goal.size} className="w-3.5 h-3.5" />
            {goal.categories && goal.categories.map((category, index) => {
              const catStyle = getCategoryStyle(category as GoalCategory, categoryColors);
              return (
                <Badge
                  key={index}
                  style={catStyle.badgeStyle}
                  className={cn('text-[10px] font-semibold py-0 px-1.5', catStyle.badgeClassName)}
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
                size="sm"
              />
            )}
          </div>
        </div>

        <h3 className="text-sm font-bold mb-1.5 line-clamp-1">{goal.title}</h3>

        {goal.description && (
          <p className="text-xs text-foreground/70 mb-2 line-clamp-1">
            <LinkifiedText text={goal.description} />
          </p>
        )}

        <div className="space-y-2">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {t("진행률")}
              </span>
              <span className="text-sm font-bold">{goal.progress}%</span>
            </div>
            <Progress value={goal.progress} className="h-1.5" />
          </div>

          {(goal.startDate || goal.dueDate) && (
            <div className="flex items-center gap-1.5 text-[10px] text-foreground/60">
              <Calendar className="w-3 h-3" />
              <span>
                {formatDate(goal.startDate)} ~ {formatDate(goal.dueDate)}
              </span>
            </div>
          )}

          {goal.statusNote && (
            <div className="text-xs">
              <span className="font-medium">{t("상태:")} </span>
              <span className="text-foreground/70 line-clamp-1">
                <LinkifiedText text={goal.statusNote} />
              </span>
            </div>
          )}
        </div>
      </div>
        </div>
  );

  // {/* HoverCardContent - 나중에 다시 사용할 경우 아래 주석 해제
  // <HoverCard openDelay={200} closeDelay={100}>
  //   <HoverCardTrigger asChild>
  //     {card}
  //   </HoverCardTrigger>
  //   <HoverCardContent
  //     className="w-96 p-4 cursor-pointer"
  //     side="right"
  //     align="start"
  //     style={{
  //       backgroundColor: getHoverCardBackground(),
  //       borderColor: categoryColors?.[primaryCategory] || categoryStyle.style?.borderColor,
  //       borderWidth: '2px',
  //       borderStyle: 'solid'
  //     }}
  //     onClick={onClick}
  //   >
  //     <div className="space-y-3">
  //       <div>
  //         <h3 className="text-lg font-bold mb-2">{goal.title}</h3>
  //         {goal.description && (
  //           <p className="text-sm text-foreground/70 mb-3">
  //             <LinkifiedText text={goal.description} />
  //           </p>
  //         )}
  //       </div>
  //       <div>
  //         <div className="flex justify-between items-center mb-2">
  //           <span className="text-sm font-semibold flex items-center gap-1">
  //             <TrendingUp className="w-4 h-4" />진행률
  //           </span>
  //           <span className="text-lg font-bold">{goal.progress}%</span>
  //         </div>
  //         <Progress value={goal.progress} className="h-2" />
  //       </div>
  //       {(goal.startDate || goal.dueDate) && (
  //         <div className="flex items-center gap-2 text-xs text-foreground/60">
  //           <Calendar className="w-3.5 h-3.5" />
  //           <span>{formatFullDate(goal.startDate)} ~ {formatFullDate(goal.dueDate)}</span>
  //         </div>
  //       )}
  //       {goal.statusNote && (
  //         <div className="text-sm">
  //           <span className="font-medium">상태: </span>
  //           <span className="text-foreground/70"><LinkifiedText text={goal.statusNote} /></span>
  //         </div>
  //       )}
  //       {goal.notes && goal.notes.some(note => note.isPinned) && (
  //         <div className="pt-3 border-t border-foreground/10">
  //           <div className="flex items-center gap-2 mb-2">
  //             <StickyNote className="w-4 h-4 text-primary" />
  //             <p className="text-sm font-semibold">중요 메모</p>
  //           </div>
  //           <div className="space-y-2">
  //             {goal.notes.filter(note => note.isPinned).slice(0, 2).map((note) => (
  //               <div key={note.id} className="p-2 bg-primary/10 rounded-md border border-primary/20">
  //                 <p className="text-xs text-foreground/80 line-clamp-3"><LinkifiedText text={note.content} /></p>
  //                 <p className="text-[10px] text-foreground/50 mt-1">
  //                   {note.updatedAt ? `수정: ${formatFullDate(note.updatedAt)}` : formatFullDate(note.createdAt)}
  //                 </p>
  //               </div>
  //             ))}
  //           </div>
  //         </div>
  //       )}
  //       {goal.subGoals && goal.subGoals.length > 0 && (
  //         <div className="pt-3 border-t border-foreground/10">
  //           <p className="text-sm font-semibold mb-2">하위 목표 {goal.subGoals.length}개</p>
  //           <div className="space-y-2">
  //             {goal.subGoals.slice(0, 3).map((subGoal) => (
  //               <div key={subGoal.id} className="space-y-1">
  //                 <div className="flex justify-between items-center">
  //                   <span className="text-xs font-medium line-clamp-1">{subGoal.title}</span>
  //                   <span className="text-xs font-semibold ml-2">{subGoal.progress}%</span>
  //                 </div>
  //                 <Progress value={subGoal.progress} className="h-1" />
  //               </div>
  //             ))}
  //             {goal.subGoals.length > 3 && (
  //               <p className="text-xs text-primary font-medium">+{goal.subGoals.length - 3}개 더보기</p>
  //             )}
  //           </div>
  //         </div>
  //       )}
  //       {goal.attachments && goal.attachments.length > 0 && (
  //         <div className="pt-3 border-t border-foreground/10">
  //           <div className="flex items-center gap-2 mb-2">
  //             <Paperclip className="w-4 h-4 text-primary" />
  //             <p className="text-sm font-semibold">첨부파일 {goal.attachments.length}개</p>
  //           </div>
  //           <div className="space-y-1">
  //             {goal.attachments.slice(0, 3).map((attachment) => (
  //               <div key={attachment.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md hover:bg-muted transition-colors group">
  //                 <span className="text-xs font-medium truncate flex-1">{attachment.originalName}</span>
  //                 <button onClick={(e) => { e.stopPropagation(); api.downloadAttachment(attachment.id); }}
  //                   className="ml-2 p-1 rounded hover:bg-primary/20 transition-colors opacity-0 group-hover:opacity-100" title="다운로드">
  //                   <Download className="w-3 h-3 text-primary" />
  //                 </button>
  //               </div>
  //             ))}
  //             {goal.attachments.length > 3 && (
  //               <p className="text-xs text-primary font-medium">+{goal.attachments.length - 3}개 더보기</p>
  //             )}
  //           </div>
  //         </div>
  //       )}
  //     </div>
  //   </HoverCardContent>
  // </HoverCard>
  // */}
};
