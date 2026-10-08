import { getLocale, t, useTranslation } from '@/i18n';
import { Goal, SubGoal, GoalSize, Note, GoalCategory, Attachment } from '@/types/goal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Trash2, Plus, Maximize2, StickyNote, Pin, Pencil, Save, X, Paperclip, Upload, Download, FileText, Check, GripVertical, MoreVertical, ChevronsUp, ChevronUp, ChevronDown, ChevronsDown, Target } from 'lucide-react';
import { useState, useEffect } from 'react';
import { MultiOwnerInput, RegisteredUser } from '@/components/OwnerInput';
import { cn, isKeyResult, computeKrProgress } from '@/lib/utils';
import { LinkifiedText } from '@/components/LinkifiedText';
import { v4 as uuidv4 } from 'uuid';
import { api, Cycle } from '@/lib/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GoalDetailModalProps {
  goal: Goal | null;
  open: boolean;
  onClose: () => void;
  /** 저장 핸들러. Promise 반환 시 모달은 resolve(성공) 시에만 닫힌다. reject(실패) 시 편집내용 보존을 위해 열린 채 유지. */
  onSave: (goal: Goal) => void | Promise<void>;
  /** 삭제 핸들러. Promise 반환 시 resolve(성공) 시에만 닫힌다. */
  onDelete: (goalId: string) => void | Promise<void>;
  categories?: GoalCategory[];
  categoryColors?: Record<string, string>;
  registeredUsers?: RegisteredUser[];
  existingOwners?: string[];
  /** 목표 삭제 버튼 노출 여부(OWNER/ADMIN만). 부모가 조직 역할로 결정해 전달. 기본 true. */
  canDelete?: boolean;
  /** 목표 주기(사이클) 선택 목록 */
  cycles?: Cycle[];
  /** 상위목표 정렬 후보(같은 프로젝트의 목표들, 자기 자신 제외) */
  goals?: Goal[];
}

export const GoalDetailModal = ({ goal, open, onClose, onSave, onDelete, categories = ['SERVICE', 'AI', 'OPERATIONS'], categoryColors = {}, registeredUsers = [], existingOwners = [], canDelete = true, cycles = [], goals = [] }: GoalDetailModalProps) => {
  useTranslation();
  const [editedGoal, setEditedGoal] = useState<Goal | null>(goal);
  // 저장/삭제 진행 중 플래그 — 성공 시에만 닫고, 중복 제출을 막는다.
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update editedGoal when goal changes
  useEffect(() => {
    if (goal) {
      console.log('GoalDetailModal: Updating with new goal data', goal);
      setEditedGoal(goal);
    }
  }, [goal]);

  if (!editedGoal) return null;

  const hasUnsavedChanges = () => {
    if (!goal || !editedGoal) return false;
    return JSON.stringify(goal) !== JSON.stringify(editedGoal);
  };

  const handleClose = () => {
    if (hasUnsavedChanges()) {
      if (!confirm(t("저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?"))) {
        return;
      }
    }
    onClose();
  };

  const handleSubGoalChange = (subGoalId: string, field: keyof SubGoal, value: any, extraFields?: Partial<SubGoal>) => {
    const updatedSubGoals = editedGoal.subGoals?.map((sg) =>
      sg.id === subGoalId ? { ...sg, [field]: value, ...extraFields } : sg
    );
    
    const newProgress = updatedSubGoals && updatedSubGoals.length > 0
      ? Math.round(updatedSubGoals.reduce((sum, sg) => sum + sg.progress, 0) / updatedSubGoals.length)
      : editedGoal.progress;
    
    setEditedGoal({ ...editedGoal, subGoals: updatedSubGoals, progress: newProgress });
  };

  const handleAddSubGoal = () => {
    const newSubGoal: SubGoal = {
      id: uuidv4(),
      title: t("새 하위 목표"),
      owner: editedGoal.owners?.[0] || editedGoal.owner,
      owners: editedGoal.owners || (editedGoal.owner ? [editedGoal.owner] : []),
      progress: 0,
      targetValue: null,
      currentValue: null,
      startValue: null,
      unit: null,
    };
    
    const updatedSubGoals = [...(editedGoal.subGoals || []), newSubGoal];
    setEditedGoal({ ...editedGoal, subGoals: updatedSubGoals });
  };

  const handleDeleteSubGoal = (subGoalId: string) => {
    const updatedSubGoals = editedGoal.subGoals?.filter((sg) => sg.id !== subGoalId);
    const newProgress = updatedSubGoals && updatedSubGoals.length > 0
      ? Math.round(updatedSubGoals.reduce((sum, sg) => sum + sg.progress, 0) / updatedSubGoals.length)
      : 0;

    setEditedGoal({ ...editedGoal, subGoals: updatedSubGoals, progress: newProgress });
  };

  const handleMoveSubGoalUp = (index: number) => {
    if (index === 0 || !editedGoal.subGoals) return;

    const updatedSubGoals = [...editedGoal.subGoals];
    [updatedSubGoals[index - 1], updatedSubGoals[index]] = [updatedSubGoals[index], updatedSubGoals[index - 1]];

    setEditedGoal({ ...editedGoal, subGoals: updatedSubGoals });
  };

  const handleMoveSubGoalDown = (index: number) => {
    if (!editedGoal.subGoals || index === editedGoal.subGoals.length - 1) return;

    const updatedSubGoals = [...editedGoal.subGoals];
    [updatedSubGoals[index], updatedSubGoals[index + 1]] = [updatedSubGoals[index + 1], updatedSubGoals[index]];

    setEditedGoal({ ...editedGoal, subGoals: updatedSubGoals });
  };

  const handleMoveSubGoalToTop = (index: number) => {
    if (index === 0 || !editedGoal.subGoals) return;

    const updatedSubGoals = [...editedGoal.subGoals];
    const [item] = updatedSubGoals.splice(index, 1);
    updatedSubGoals.unshift(item);

    setEditedGoal({ ...editedGoal, subGoals: updatedSubGoals });
  };

  const handleMoveSubGoalToBottom = (index: number) => {
    if (!editedGoal.subGoals || index === editedGoal.subGoals.length - 1) return;

    const updatedSubGoals = [...editedGoal.subGoals];
    const [item] = updatedSubGoals.splice(index, 1);
    updatedSubGoals.push(item);

    setEditedGoal({ ...editedGoal, subGoals: updatedSubGoals });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !editedGoal.subGoals) return;

    const oldIndex = editedGoal.subGoals.findIndex((sg) => sg.id === active.id);
    const newIndex = editedGoal.subGoals.findIndex((sg) => sg.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const updatedSubGoals = arrayMove(editedGoal.subGoals, oldIndex, newIndex);
    setEditedGoal({ ...editedGoal, subGoals: updatedSubGoals });
  };

  const handleAddNote = (content: string, isPinned: boolean) => {
    if (!content.trim()) return;

    const newNote: Note = {
      id: uuidv4(),
      content,
      createdAt: new Date().toISOString(),
      isPinned,
    };

    const updatedNotes = [...(editedGoal.notes || []), newNote];
    setEditedGoal({ ...editedGoal, notes: updatedNotes });
  };

  const handleTogglePin = (noteId: string) => {
    const updatedNotes = editedGoal.notes?.map((note) =>
      note.id === noteId ? { ...note, isPinned: !note.isPinned } : note
    );
    setEditedGoal({ ...editedGoal, notes: updatedNotes });
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = editedGoal.notes?.filter((note) => note.id !== noteId);
    setEditedGoal({ ...editedGoal, notes: updatedNotes });
  };

  const handleEditNote = (noteId: string, newContent: string) => {
    const updatedNotes = editedGoal.notes?.map((note) =>
      note.id === noteId ? { ...note, content: newContent, updatedAt: new Date().toISOString() } : note
    );
    setEditedGoal({ ...editedGoal, notes: updatedNotes });
  };

  const handleSave = async () => {
    if (!editedGoal.owners || editedGoal.owners.length === 0) {
      alert(t("최소 1명의 담당자를 선택해야 합니다."));
      return;
    }
    try {
      setSaving(true);
      await onSave(editedGoal);
      onClose(); // 성공 시에만 닫기 → 실패 시 편집내용 보존(모달 유지)
    } catch {
      // 저장 실패: 모달을 열어둔 채 편집내용을 보존한다. 에러 메시지는 핸들러(toast/alert)가 표시.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(t("이 목표를 삭제하시겠습니까?"))) {
      try {
        setSaving(true);
        await onDelete(editedGoal.id);
        onClose(); // 성공 시에만 닫기
      } catch {
        // 삭제 실패: 모달 유지
      } finally {
        setSaving(false);
      }
    }
  };

  const hasSubGoals = editedGoal.subGoals && editedGoal.subGoals.length > 0;

  // 상위목표 후보: 자기 자신 제외 (순환 정렬 방지)
  const alignableGoals = goals.filter((g) => g.id !== editedGoal.id);

  const sizeOptions: { value: GoalSize; label: string; description: string }[] = [
    { value: 'xs', label: t("최저 중요도"), description: t("1x1 카드") },
    { value: 'small', label: t("낮은 중요도"), description: t("1x1 카드") },
    { value: 'medium', label: t("중간 중요도"), description: t("1x2 카드 (높이 2배)") },
    { value: 'large', label: t("높은 중요도"), description: t("2x2 카드 (가로/세로 2배)") },
    { value: 'xl', label: t("최고 중요도"), description: t("2x3 카드 (매우 큰 크기)") },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t("목표 상세")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>{t("제목")}</Label>
              <Input
                value={editedGoal.title}
                onChange={(e) => setEditedGoal({ ...editedGoal, title: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label>{t("설명")}</Label>
              <Textarea
                value={editedGoal.description || ''}
                onChange={(e) => setEditedGoal({ ...editedGoal, description: e.target.value })}
                rows={3}
                placeholder={t("목표에 대한 상세 설명을 입력하세요")}
                className="mt-2"
              />
            </div>

            <div>
              <Label>{t("담당자 (복수 선택 가능)")}</Label>
              <MultiOwnerInput
                values={editedGoal.owners || (editedGoal.owner ? [editedGoal.owner] : [])}
                onChange={(values) => setEditedGoal({ ...editedGoal, owners: values, owner: values[0] || '' })}
                registeredUsers={registeredUsers}
                existingOwners={existingOwners}
              />
            </div>

            <div className="col-span-2">
              <Label>{t("카테고리 (최소 1개, 최대 5개) - 선택됨:")} {editedGoal.categories?.length || 0} / 5</Label>
              <div className="mt-2 flex flex-wrap gap-2 p-3 border rounded-md bg-background">
                {categories.map((category) => {
                  const isSelected = editedGoal.categories?.includes(category);
                  const canSelect = !isSelected && (editedGoal.categories?.length || 0) < 5;
                  const canDeselect = isSelected && (editedGoal.categories?.length || 0) > 1;
                  const color = categoryColors[category] || '#6b7280';

                  return (
                    <button
                      key={category}
                      type="button"
                      disabled={(!canSelect && !isSelected) || (!canDeselect && isSelected)}
                      onClick={() => {
                        const newCategories = isSelected
                          ? (editedGoal.categories || []).filter(c => c !== category)
                          : [...(editedGoal.categories || []), category];
                        setEditedGoal({ ...editedGoal, categories: newCategories });
                      }}
                      className={cn(
                        "relative px-3 py-1.5 rounded-md text-sm font-medium transition-all border-2",
                        (!canSelect && !isSelected) && "opacity-50 cursor-not-allowed"
                      )}
                      style={{
                        backgroundColor: isSelected ? color : `${color}15`,
                        borderColor: isSelected ? color : `${color}40`,
                        color: isSelected ? '#ffffff' : color,
                      }}
                    >
                      {category}
                      {isSelected && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Maximize2 className="w-4 h-4 text-primary" />
              <Label>{t("카드 크기 (중요도)")}</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {sizeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setEditedGoal({ ...editedGoal, size: option.value })}
                  className={cn(
                    'p-2.5 rounded-lg border-2 text-left transition-all',
                    editedGoal.size === option.value
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'border-border bg-card hover:border-primary/50'
                  )}
                >
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("시작일")}</Label>
              <Input
                type="date"
                value={editedGoal.startDate || ''}
                onChange={(e) => setEditedGoal({ ...editedGoal, startDate: e.target.value })}
              />
            </div>

            <div>
              <Label>{t("종료일")}</Label>
              <Input
                type="date"
                value={editedGoal.dueDate || ''}
                onChange={(e) => setEditedGoal({ ...editedGoal, dueDate: e.target.value })}
              />
            </div>

            <div>
              <Label>{t("사이클")}</Label>
              <Select
                value={editedGoal.cycleId || '__none__'}
                onValueChange={(value) =>
                  setEditedGoal({ ...editedGoal, cycleId: value === '__none__' ? null : value })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("사이클 선택")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("없음")}</SelectItem>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("상위 목표 (정렬)")}</Label>
              <Select
                value={editedGoal.parentGoalId || '__none__'}
                onValueChange={(value) =>
                  setEditedGoal({ ...editedGoal, parentGoalId: value === '__none__' ? null : value })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("상위 목표 선택")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("없음")}</SelectItem>
                  {alignableGoals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>{t("상태 메모")}</Label>
              <Textarea
                value={editedGoal.statusNote || ''}
                onChange={(e) => setEditedGoal({ ...editedGoal, statusNote: e.target.value })}
                placeholder={t("현재 상태에 대한 간단한 메모")}
                rows={2}
                className="mt-2 resize-none"
              />
            </div>

            {!hasSubGoals && (
              <div className="col-span-2">
                <Label>{t("진행률:")} {editedGoal.progress}%</Label>
                <Slider
                  value={[editedGoal.progress]}
                  onValueChange={([value]) => setEditedGoal({ ...editedGoal, progress: value })}
                  max={100}
                  step={5}
                  className="mt-2"
                />
                <Progress value={editedGoal.progress} className="mt-2 h-2" />
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">{t("메모")}</h3>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <NoteInput onAddNote={handleAddNote} />
              
              {editedGoal.notes && editedGoal.notes.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {editedGoal.notes
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onTogglePin={handleTogglePin}
                        onDelete={handleDeleteNote}
                        onEdit={handleEditNote}
                      />
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("아직 메모가 없습니다")}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">{t("첨부파일")}</h3>
              </div>
            </div>

            <AttachmentSection
              goalId={editedGoal.id}
              attachments={editedGoal.attachments || []}
              onAttachmentsChange={(attachments) => setEditedGoal({ ...editedGoal, attachments })}
            />
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t("하위 목표")}</h3>
              <Button onClick={handleAddSubGoal} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                {t("하위 목표 추가")}
              </Button>
            </div>

            {hasSubGoals && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={editedGoal.subGoals!.map((sg) => sg.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {editedGoal.subGoals!.map((subGoal, index) => (
                      <SortableSubGoalCard
                        key={subGoal.id}
                        subGoal={subGoal}
                        index={index}
                        total={editedGoal.subGoals!.length}
                        onSubGoalChange={handleSubGoalChange}
                        onMoveUp={handleMoveSubGoalUp}
                        onMoveDown={handleMoveSubGoalDown}
                        onMoveToTop={handleMoveSubGoalToTop}
                        onMoveToBottom={handleMoveSubGoalToBottom}
                        onDelete={handleDeleteSubGoal}
                        registeredUsers={registeredUsers}
                        existingOwners={existingOwners}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            
            {hasSubGoals && (
              <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">{t("자동 계산된 전체 진행률")}</span>
                  <span className="text-xl font-bold text-primary">{editedGoal.progress}%</span>
                </div>
                <Progress value={editedGoal.progress} className="h-2" />
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            {canDelete ? (
              <Button onClick={handleDelete} variant="destructive" disabled={saving}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t("목표 삭제")}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button onClick={handleClose} variant="outline" disabled={saving}>
                {t("취소")}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t("저장 중…") : t("저장")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SortableSubGoalCard = ({
  subGoal,
  index,
  total,
  onSubGoalChange,
  onMoveUp,
  onMoveDown,
  onMoveToTop,
  onMoveToBottom,
  onDelete,
  registeredUsers,
  existingOwners,
}: {
  subGoal: SubGoal;
  index: number;
  total: number;
  onSubGoalChange: (id: string, field: keyof SubGoal, value: any, extraFields?: Partial<SubGoal>) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onMoveToTop: (index: number) => void;
  onMoveToBottom: (index: number) => void;
  onDelete: (id: string) => void;
  registeredUsers: RegisteredUser[];
  existingOwners: string[];
}) => {
  useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subGoal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isFirst = index === 0;
  const isLast = index === total - 1;

  // Key Result(정량 지표) 상태
  const isKr = isKeyResult(subGoal);
  const [showKr, setShowKr] = useState(
    isKr || subGoal.currentValue != null || subGoal.startValue != null || (subGoal.unit ?? '') !== ''
  );

  const parseNum = (v: string): number | null => {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  // KR 필드 변경 시, KR로 판정되면 자동 계산 진행률을 subgoal.progress에 반영해
  // 상위 목표 평균 재계산이 자동 진행률을 사용하도록 한다.
  const handleKrChange = (field: keyof SubGoal, value: number | string | null) => {
    const updated = { ...subGoal, [field]: value } as SubGoal;
    if (isKeyResult(updated)) {
      onSubGoalChange(subGoal.id, field, value, { progress: computeKrProgress(updated) });
    } else {
      onSubGoalChange(subGoal.id, field, value);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-4 bg-muted rounded-lg space-y-3",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
            aria-label={t("드래그하여 순서 변경")}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground">{t("하위 목표")} {index + 1}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`subgoal-menu-${index}`}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onMoveToTop(index)}
              disabled={isFirst}
            >
              <ChevronsUp className="w-4 h-4 mr-2" />
              {t("맨 위로 이동")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onMoveUp(index)}
              disabled={isFirst}
            >
              <ChevronUp className="w-4 h-4 mr-2" />
              {t("위로 이동")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onMoveDown(index)}
              disabled={isLast}
            >
              <ChevronDown className="w-4 h-4 mr-2" />
              {t("아래로 이동")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onMoveToBottom(index)}
              disabled={isLast}
            >
              <ChevronsDown className="w-4 h-4 mr-2" />
              {t("맨 아래로 이동")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(subGoal.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("삭제")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3">
          <Label className="text-xs">{t("제목")}</Label>
          <Input
            value={subGoal.title}
            onChange={(e) => onSubGoalChange(subGoal.id, 'title', e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="col-span-3">
          <Label className="text-xs">{t("담당자")}</Label>
          <MultiOwnerInput
            values={subGoal.owners || (subGoal.owner ? [subGoal.owner] : [])}
            onChange={(values) => {
              onSubGoalChange(subGoal.id, 'owners' as keyof SubGoal, values, { owner: values[0] || '' });
            }}
            registeredUsers={registeredUsers}
            existingOwners={existingOwners}
            className="mt-1"
          />
        </div>

        <div className="col-span-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-full sm:w-[150px] shrink-0">
              <Label className="text-xs">{t("시작일")}</Label>
              <Input
                type="date"
                value={subGoal.startDate || ''}
                onChange={(e) => onSubGoalChange(subGoal.id, 'startDate', e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="w-full sm:w-[150px] shrink-0">
              <Label className="text-xs">{t("종료일")}</Label>
              <Input
                type="date"
                value={subGoal.dueDate || ''}
                onChange={(e) => onSubGoalChange(subGoal.id, 'dueDate', e.target.value)}
                className="mt-1"
              />
            </div>
            {subGoal.startDate && (
              <button
                type="button"
                onClick={() => {
                  onSubGoalChange(subGoal.id, 'startDate', '', { dueDate: '' });
                }}
                className="mt-4 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
              >
                {t("초기화")}
              </button>
            )}
            <div className="flex-1 min-w-0 mt-4">
              {isKr ? (
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">{t("진행률(자동)")}</Label>
                  <span className="text-xs font-medium text-primary whitespace-nowrap">
                    {subGoal.currentValue ?? 0}/{subGoal.targetValue}
                    {subGoal.unit ? ` ${subGoal.unit}` : ''} · {computeKrProgress(subGoal)}%
                  </span>
                  <Progress value={computeKrProgress(subGoal)} className="h-1.5 flex-1" />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">{t("진행률:")} {subGoal.progress}%</Label>
                  <Slider
                    value={[subGoal.progress]}
                    onValueChange={([value]) => onSubGoalChange(subGoal.id, 'progress', value)}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-3">
          <button
            type="button"
            onClick={() => setShowKr((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Target className="w-3.5 h-3.5" />
            {t("정량 지표(KR)")}{isKr ? t("· 자동 진행률 사용 중") : ''}
            {showKr ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showKr && (
            <>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">{t("시작값")}</Label>
                  <Input
                    type="number"
                    value={subGoal.startValue ?? ''}
                    onChange={(e) => handleKrChange('startValue', parseNum(e.target.value))}
                    className="mt-1 h-9"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("현재값")}</Label>
                  <Input
                    type="number"
                    value={subGoal.currentValue ?? ''}
                    onChange={(e) => handleKrChange('currentValue', parseNum(e.target.value))}
                    className="mt-1 h-9"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("목표값")}</Label>
                  <Input
                    type="number"
                    value={subGoal.targetValue ?? ''}
                    onChange={(e) => handleKrChange('targetValue', parseNum(e.target.value))}
                    className="mt-1 h-9"
                    placeholder={t("예: 100")}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("단위")}</Label>
                  <Input
                    value={subGoal.unit ?? ''}
                    onChange={(e) => handleKrChange('unit', e.target.value === '' ? null : e.target.value)}
                    className="mt-1 h-9"
                    placeholder={t("예: %, 건")}
                  />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {t("목표값을 입력하면 (현재값-시작값)/(목표값-시작값)으로 진행률이 자동 계산됩니다.")}
              </p>
            </>
          )}
        </div>

        <div className="col-span-3">
          <Label className="text-xs">{t("상태 메모")}</Label>
          <Textarea
            value={subGoal.statusNote || ''}
            onChange={(e) => onSubGoalChange(subGoal.id, 'statusNote', e.target.value)}
            placeholder={t("상태 메모")}
            rows={2}
            className="mt-1 resize-none"
          />
        </div>
      </div>
    </div>
  );
};

const NoteCard = ({
  note,
  onTogglePin,
  onDelete,
  onEdit
}: {
  note: Note;
  onTogglePin: (noteId: string) => void;
  onDelete: (noteId: string) => void;
  onEdit: (noteId: string, newContent: string) => void;
}) => {
  useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);

  const handleSave = () => {
    if (!editContent.trim()) return;
    onEdit(note.id, editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(note.content);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg border-2 transition-all',
        note.isPinned
          ? 'bg-primary/10 border-primary/30'
          : 'bg-muted border-border'
      )}
    >
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full"
          />
          <div className="flex justify-end gap-1">
            <Button
              onClick={handleCancel}
              variant="ghost"
              size="sm"
              className="h-7"
            >
              <X className="w-4 h-4 mr-1" />
              {t("취소")}
            </Button>
            <Button
              onClick={handleSave}
              variant="default"
              size="sm"
              className="h-7"
            >
              <Save className="w-4 h-4 mr-1" />
              {t("저장")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start gap-2">
            <p className="text-sm text-foreground flex-1">
              <LinkifiedText text={note.content} />
            </p>
            <div className="flex gap-1">
              <Button
                onClick={() => setIsEditing(true)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={t("수정")}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => onTogglePin(note.id)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={note.isPinned ? t("고정 해제") : t("고정")}
              >
                <Pin className={cn("w-4 h-4", note.isPinned && "fill-primary text-primary")} />
              </Button>
              <Button
                onClick={() => onDelete(note.id)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive"
                title={t("삭제")}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {note.updatedAt
              ? t("수정: {{value0}}", { value0: new Date(note.updatedAt).toLocaleString(getLocale()) })
              : new Date(note.createdAt).toLocaleString(getLocale())}
          </p>
        </>
      )}
    </div>
  );
};

const NoteInput = ({ onAddNote }: { onAddNote: (content: string, isPinned: boolean) => void }) => {
  useTranslation();
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const handleAdd = () => {
    if (!content.trim()) return;
    onAddNote(content, isPinned);
    setContent('');
    setIsPinned(false);
  };

  return (
    <div className="p-3 bg-card border-2 border-border rounded-lg space-y-2">
      <Textarea
        placeholder={t("메모 내용을 입력하세요...")}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
      />
      <div className="flex items-center gap-2 justify-end">
        <Button
          onClick={() => setIsPinned(!isPinned)}
          variant={isPinned ? "default" : "outline"}
          size="sm"
          className="gap-1"
        >
          <Pin className={cn("w-4 h-4", isPinned && "fill-current")} />
          {isPinned ? t("중요") : t("일반")}
        </Button>
        <Button onClick={handleAdd} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          {t("추가")}
        </Button>
      </div>
    </div>
  );
};

const AttachmentSection = ({
  goalId,
  attachments,
  onAttachmentsChange,
}: {
  goalId: string;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}) => {
  useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError(t("파일 크기는 50MB를 초과할 수 없습니다."));
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const newAttachment = await api.uploadAttachment(goalId, file);
      onAttachmentsChange([...attachments, newAttachment]);

      // Reset file input
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(t("파일 업로드에 실패했습니다."));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = (attachmentId: string) => {
    api.downloadAttachment(attachmentId);
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm(t("이 파일을 삭제하시겠습니까?"))) return;

    try {
      await api.deleteAttachment(attachmentId);
      onAttachmentsChange(attachments.filter(a => a.id !== attachmentId));
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert(t("파일 삭제에 실패했습니다."));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label
          htmlFor="file-upload"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md border-2 border-dashed cursor-pointer transition-colors",
            isUploading
              ? "bg-muted border-muted-foreground/50 cursor-not-allowed"
              : "hover:bg-muted border-border"
          )}
        >
          <Upload className="w-4 h-4" />
          <span className="text-sm">
            {isUploading ? t("업로드 중...") : t("파일 선택")}
          </span>
        </label>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <span className="text-xs text-muted-foreground">
          {t("최대 50MB")}
        </span>
      </div>

      {uploadError && (
        <p className="text-sm text-destructive">{uploadError}</p>
      )}

      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {attachment.originalName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  onClick={() => handleDownload(attachment.id)}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title={t("다운로드")}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDelete(attachment.id)}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  title={t("삭제")}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          {t("첨부된 파일이 없습니다")}
        </p>
      )}
    </div>
  );
};
