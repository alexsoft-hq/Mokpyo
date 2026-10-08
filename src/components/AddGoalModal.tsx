import { t, useTranslation } from '@/i18n';
import { Goal, GoalCategory, GoalSize } from '@/types/goal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Maximize2, Check, Plus, X, Pencil, Palette, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useState, useEffect, useRef } from 'react';
import { MultiOwnerInput, RegisteredUser } from '@/components/OwnerInput';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { Cycle } from '@/lib/api';
import { findCurrentCycle } from '@/lib/cycleUtils';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#1f2937',
];

interface AddGoalModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (goal: Goal) => void;
  categories: GoalCategory[];
  categoryColors?: Record<string, string>;
  onAddCategory?: (name: string) => Promise<void>;
  onUpdateCategoryColor?: (category: string, color: string) => Promise<void>;
  onUpdateCategoryName?: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory?: (category: string) => Promise<void>;
  registeredUsers?: RegisteredUser[];
  existingOwners?: string[];
  /** 목표 주기(사이클) 선택 목록 */
  cycles?: Cycle[];
  /** 상위목표 정렬 후보(같은 프로젝트의 목표들) */
  goals?: Goal[];
}

export const AddGoalModal = ({
  open,
  onClose,
  onAdd,
  categories,
  categoryColors = {},
  onAddCategory,
  onUpdateCategoryColor,
  onUpdateCategoryName,
  onDeleteCategory,
  registeredUsers = [],
  existingOwners = [],
  cycles = [],
  goals = [],
}: AddGoalModalProps) => {
  useTranslation();
  const [newGoal, setNewGoal] = useState<Partial<Goal> & { owners?: string[] }>({
    title: '',
    description: '',
    owner: '',
    owners: [],
    categories: [],
    size: 'medium',
    progress: 0,
    startDate: '',
    dueDate: '',
    statusNote: '',
    cycleId: null,
    parentGoalId: null,
  });

  // 모달이 닫힘→열림으로 전환될 때 오늘이 속한 사이클을 기본 선택 (분기·연간 겹치면 짧은 쪽).
  // 사용자가 사이클을 한 번이라도 직접 고르면(명시적 '없음' 포함) 초안이 리셋되기 전까지 덮어쓰지 않는다.
  const wasOpen = useRef(false);
  const cycleTouched = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current && !cycleTouched.current) {
      const current = findCurrentCycle(cycles);
      if (current) {
        setNewGoal((prev) => (prev.cycleId ? prev : { ...prev, cycleId: current.id }));
      }
    }
    wasOpen.current = open;
  }, [open, cycles]);

  // 새 카테고리 추가
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);

  // 카테고리 편집
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // 색상 편집
  const [colorPickerCategory, setColorPickerCategory] = useState<string | null>(null);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !onAddCategory) return;
    if (categories.includes(newCategoryName.trim())) {
      alert(t("이미 존재하는 카테고리입니다."));
      return;
    }

    try {
      await onAddCategory(newCategoryName.trim());
      // 새 카테고리를 자동으로 선택
      if ((newGoal.categories?.length || 0) < 5) {
        setNewGoal({ ...newGoal, categories: [...(newGoal.categories || []), newCategoryName.trim()] });
      }
      setNewCategoryName('');
      setShowAddCategory(false);
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const handleColorChange = async (category: string, color: string, closeAfter: boolean = false) => {
    if (!onUpdateCategoryColor) return;
    try {
      await onUpdateCategoryColor(category, color);
      if (closeAfter) {
        setColorPickerCategory(null);
      }
    } catch (error) {
      console.error('Failed to update color:', error);
    }
  };

  const handleNameChange = async (oldName: string) => {
    if (!onUpdateCategoryName || !editingName.trim() || editingName === oldName) {
      setEditingCategory(null);
      setEditingName('');
      return;
    }
    if (categories.includes(editingName.trim()) && editingName.trim() !== oldName) {
      alert(t("이미 존재하는 카테고리입니다."));
      return;
    }

    try {
      await onUpdateCategoryName(oldName, editingName.trim());
      // 선택된 카테고리 목록도 업데이트
      if (newGoal.categories?.includes(oldName)) {
        setNewGoal({
          ...newGoal,
          categories: newGoal.categories.map(c => c === oldName ? editingName.trim() : c)
        });
      }
      setEditingCategory(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update name:', error);
    }
  };

  const handleDeleteCategory = async (category: string) => {
    if (!onDeleteCategory) return;

    if (!confirm(t("'{{value0}}' 카테고리를 삭제하시겠습니까?", { value0: category }))) return;

    try {
      await onDeleteCategory(category);
      // 선택된 카테고리에서도 제거
      if (newGoal.categories?.includes(category)) {
        setNewGoal({
          ...newGoal,
          categories: newGoal.categories.filter(c => c !== category)
        });
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const startEditing = (category: string) => {
    setEditingCategory(category);
    setEditingName(category);
    setColorPickerCategory(null);
  };

  const handleAdd = () => {
    const owners = newGoal.owners || [];
    if (!newGoal.title || owners.length === 0) {
      alert(t("제목과 담당자는 필수 입력 항목입니다."));
      return;
    }

    if (!newGoal.categories || newGoal.categories.length === 0) {
      alert(t("최소 1개의 카테고리를 선택해야 합니다."));
      return;
    }

    const goal: Goal = {
      id: uuidv4(),
      title: newGoal.title,
      description: newGoal.description,
      owner: owners[0],
      owners: owners,
      categories: newGoal.categories as GoalCategory[],
      size: newGoal.size as GoalSize,
      progress: newGoal.progress || 0,
      startDate: newGoal.startDate,
      dueDate: newGoal.dueDate,
      statusNote: newGoal.statusNote,
      cycleId: newGoal.cycleId ?? null,
      parentGoalId: newGoal.parentGoalId ?? null,
      subGoals: [],
    };

    onAdd(goal);

    // Reset form
    cycleTouched.current = false;
    setNewGoal({
      title: '',
      description: '',
      owner: '',
      owners: [],
      categories: [],
      size: 'medium',
      progress: 0,
      startDate: '',
      dueDate: '',
      statusNote: '',
      cycleId: null,
      parentGoalId: null,
    });

    onClose();
  };

  const sizeOptions: { value: GoalSize; label: string; description: string }[] = [
    { value: 'xs', label: t("최저 중요도"), description: t("1x1 카드") },
    { value: 'small', label: t("낮은 중요도"), description: t("1x1 카드") },
    { value: 'medium', label: t("중간 중요도"), description: t("1x2 카드 (높이 2배)") },
    { value: 'large', label: t("높은 중요도"), description: t("2x2 카드 (가로/세로 2배)") },
    { value: 'xl', label: t("최고 중요도"), description: t("2x3 카드 (매우 큰 크기)") },
  ];

  const hasManagementFeatures = onAddCategory || onUpdateCategoryColor || onUpdateCategoryName || onDeleteCategory;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t("새 목표 추가")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t("제목 *")}</Label>
            <Input
              value={newGoal.title}
              onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              placeholder={t("목표 제목을 입력하세요")}
            />
          </div>

          <div>
            <Label>{t("설명")}</Label>
            <Textarea
              value={newGoal.description}
              onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
              placeholder={t("목표에 대한 간단한 설명")}
              rows={3}
            />
          </div>

          <div>
            <Label>{t("담당자 * (복수 선택 가능)")}</Label>
            <MultiOwnerInput
              values={newGoal.owners || []}
              onChange={(values) => setNewGoal({ ...newGoal, owners: values, owner: values[0] || '' })}
              registeredUsers={registeredUsers}
              existingOwners={existingOwners}
              placeholder={t("담당자 추가")}
            />
          </div>

          <div>
            <Label>{t("카테고리 * (최소 1개, 최대 5개) - 선택됨:")} {newGoal.categories?.length || 0} / 5</Label>
            <div className="mt-2 space-y-2 p-3 border rounded-md bg-background">
              {categories.map((category) => {
                const isSelected = newGoal.categories?.includes(category);
                const canSelect = !isSelected && (newGoal.categories?.length || 0) < 5;
                const color = categoryColors[category] || '#6b7280';
                const isEditing = editingCategory === category;
                const isColorPicking = colorPickerCategory === category;

                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center gap-2">
                      {/* 카테고리 버튼 */}
                      <button
                        type="button"
                        disabled={!canSelect && !isSelected}
                        onClick={() => {
                          if (isEditing) return;
                          const newCategories = isSelected
                            ? (newGoal.categories || []).filter(c => c !== category)
                            : [...(newGoal.categories || []), category];
                          setNewGoal({ ...newGoal, categories: newCategories });
                        }}
                        className={cn(
                          "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all border-2 text-left",
                          (!canSelect && !isSelected) && "opacity-50 cursor-not-allowed"
                        )}
                        style={{
                          backgroundColor: isSelected ? color : `${color}15`,
                          borderColor: isSelected ? color : `${color}40`,
                          color: isSelected ? '#ffffff' : color,
                        }}
                      >
                        {isEditing ? (
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleNameChange(category);
                              }
                              if (e.key === 'Escape') {
                                setEditingCategory(null);
                                setEditingName('');
                              }
                            }}
                            onBlur={() => handleNameChange(category)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-5 text-xs px-1 bg-white text-foreground border-0"
                            autoFocus
                          />
                        ) : (
                          <span className="truncate block">{category}</span>
                        )}
                      </button>

                      {/* 체크 아이콘 */}
                      <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                        {isSelected && !isEditing && (
                          <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </span>

                      {/* 편집 버튼들 */}
                      {hasManagementFeatures && !isEditing && (
                        <div className="flex gap-0.5 flex-shrink-0">
                          {onUpdateCategoryName && (
                            <button
                              type="button"
                              onClick={() => startEditing(category)}
                              className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                              title={t("이름 변경")}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onUpdateCategoryColor && (
                            <button
                              type="button"
                              onClick={() => setColorPickerCategory(isColorPicking ? null : category)}
                              className={cn(
                                "p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors",
                                isColorPicking && "bg-accent/50 text-foreground"
                              )}
                              title={t("색상 변경")}
                            >
                              <Palette className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteCategory && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(category)}
                              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                              title={t("삭제")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 색상 선택기 */}
                    {isColorPicking && (
                      <div className="px-2 py-2 bg-muted/50 rounded-md ml-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => handleColorChange(category, e.target.value)}
                            className="w-8 h-6 rounded cursor-pointer border-0"
                          />
                          <span className="text-xs text-muted-foreground">{t("직접 선택")}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {PRESET_COLORS.map((presetColor) => (
                            <button
                              key={presetColor}
                              type="button"
                              onClick={() => handleColorChange(category, presetColor, true)}
                              className={cn(
                                'w-5 h-5 rounded-sm border-2 hover:scale-110 transition-transform',
                                color === presetColor ? 'border-primary' : 'border-transparent'
                              )}
                              style={{ backgroundColor: presetColor }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 카테고리 추가 */}
              {onAddCategory && (
                showAddCategory ? (
                  <div className="flex items-center gap-1 pt-2 border-t">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder={t("새 카테고리명")}
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                        if (e.key === 'Escape') {
                          setShowAddCategory(false);
                          setNewCategoryName('');
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={handleAddCategory}
                      disabled={!newCategoryName.trim()}
                    >
                      {t("추가")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => {
                        setShowAddCategory(false);
                        setNewCategoryName('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-t pt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t("새 카테고리 추가")}</span>
                  </button>
                )
              )}

              {/* 카테고리가 없을 때 안내 메시지 */}
              {categories.length === 0 && !showAddCategory && (
                <p className="text-sm text-muted-foreground">
                  {t("카테고리가 없습니다. 아래 버튼을 눌러 새 카테고리를 만들어주세요.")}
                </p>
              )}
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
                  onClick={() => setNewGoal({ ...newGoal, size: option.value })}
                  className={cn(
                    'p-2.5 rounded-lg border-2 text-left transition-all',
                    newGoal.size === option.value
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
                value={newGoal.startDate}
                onChange={(e) => setNewGoal({ ...newGoal, startDate: e.target.value })}
              />
            </div>

            <div>
              <Label>{t("종료일")}</Label>
              <Input
                type="date"
                value={newGoal.dueDate}
                onChange={(e) => setNewGoal({ ...newGoal, dueDate: e.target.value })}
              />
            </div>

            <div>
              <Label>{t("사이클")}</Label>
              <Select
                value={newGoal.cycleId || '__none__'}
                onValueChange={(value) => {
                  cycleTouched.current = true;
                  setNewGoal({ ...newGoal, cycleId: value === '__none__' ? null : value });
                }}
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
                value={newGoal.parentGoalId || '__none__'}
                onValueChange={(value) =>
                  setNewGoal({ ...newGoal, parentGoalId: value === '__none__' ? null : value })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("상위 목표 선택")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("없음")}</SelectItem>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>{t("상태 메모")}</Label>
            <Input
              value={newGoal.statusNote}
              onChange={(e) => setNewGoal({ ...newGoal, statusNote: e.target.value })}
              placeholder={t("현재 상태를 간단히 입력하세요")}
            />
          </div>

          <div>
            <Label>{t("진행률:")} {newGoal.progress}%</Label>
            <Slider
              value={[newGoal.progress || 0]}
              onValueChange={([value]) => setNewGoal({ ...newGoal, progress: value })}
              max={100}
              step={5}
              className="mt-2"
            />
            <Progress value={newGoal.progress || 0} className="mt-2 h-2" />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={onClose} variant="outline">
              {t("취소")}
            </Button>
            <Button onClick={handleAdd}>
              {t("추가")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
