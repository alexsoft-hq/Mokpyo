import { useState } from 'react';
import { Goal, GoalCategory } from '@/types/goal';
import { Plus, Check, Pencil, Trash2, X, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CategoryQuickEditorProps {
  goal: Goal;
  categories: GoalCategory[];
  categoryColors: Record<string, string>;
  onUpdateCategories: (goalId: string, categories: GoalCategory[]) => Promise<void>;
  onAddCategory?: (name: string) => Promise<void>;
  onUpdateCategoryColor?: (category: string, color: string) => Promise<void>;
  onUpdateCategoryName?: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory?: (category: string) => Promise<void>;
  /** 각 카테고리를 사용하는 목표 수 */
  categoryUsageCount?: Record<string, number>;
  size?: 'sm' | 'md';
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#1f2937',
];

export const CategoryQuickEditor = ({
  goal,
  categories,
  categoryColors,
  onUpdateCategories,
  onAddCategory,
  onUpdateCategoryColor,
  onUpdateCategoryName,
  onDeleteCategory,
  categoryUsageCount = {},
  size = 'md',
}: CategoryQuickEditorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<GoalCategory[]>(goal.categories || []);

  // 새 카테고리 추가
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);

  // 카테고리 편집
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // 색상 편집
  const [colorPickerCategory, setColorPickerCategory] = useState<string | null>(null);

  const handleToggleCategory = (category: GoalCategory) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        if (prev.length <= 1) return prev;
        return prev.filter(c => c !== category);
      } else {
        if (prev.length >= 5) return prev;
        return [...prev, category];
      }
    });
  };

  const handleSave = async () => {
    if (selectedCategories.length === 0) return;

    setIsLoading(true);
    try {
      await onUpdateCategories(goal.id, selectedCategories);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim() || !onAddCategory) return;
    if (categories.includes(newCategoryName.trim())) {
      alert('이미 존재하는 카테고리입니다.');
      return;
    }

    try {
      await onAddCategory(newCategoryName.trim());
      if (selectedCategories.length < 5) {
        setSelectedCategories(prev => [...prev, newCategoryName.trim()]);
      }
      setNewCategoryName('');
      setShowAddInput(false);
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
      alert('이미 존재하는 카테고리입니다.');
      return;
    }

    try {
      await onUpdateCategoryName(oldName, editingName.trim());
      // 선택된 카테고리 목록도 업데이트
      setSelectedCategories(prev => prev.map(c => c === oldName ? editingName.trim() : c));
      setEditingCategory(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update name:', error);
    }
  };

  const handleDeleteCategory = async (category: string) => {
    if (!onDeleteCategory) return;

    const usageCount = categoryUsageCount[category] || 0;
    if (usageCount > 0) {
      alert(`이 카테고리를 사용하는 목표가 ${usageCount}개 있어 삭제할 수 없습니다.`);
      return;
    }

    if (!confirm(`'${category}' 카테고리를 삭제하시겠습니까?`)) return;

    try {
      await onDeleteCategory(category);
      setSelectedCategories(prev => prev.filter(c => c !== category));
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const startEditing = (category: string) => {
    setEditingCategory(category);
    setEditingName(category);
    setColorPickerCategory(null);
  };

  const hasChanges = JSON.stringify(selectedCategories.sort()) !== JSON.stringify([...(goal.categories || [])].sort());

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const buttonSize = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setEditingCategory(null);
        setColorPickerCategory(null);
        setShowAddInput(false);
      }
    }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCategories(goal.categories || []);
          }}
          className={cn(
            buttonSize,
            'inline-flex items-center justify-center rounded-full',
            'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground',
            'transition-all duration-200',
            'border border-transparent hover:border-border'
          )}
          title="카테고리 편집"
        >
          <Plus className={iconSize} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3"
        onClick={(e) => e.stopPropagation()}
        align="start"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">카테고리 관리</span>
            <span className="text-xs text-muted-foreground">
              선택: {selectedCategories.length}/5
            </span>
          </div>

          {/* 카테고리 목록 - 편집 화면 스타일 */}
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {categories.map((category) => {
              const isSelected = selectedCategories.includes(category);
              const color = categoryColors[category] || '#6b7280';
              const canSelect = isSelected || selectedCategories.length < 5;
              const canDeselect = !isSelected || selectedCategories.length > 1;
              const usageCount = categoryUsageCount[category] || 0;
              const isEditing = editingCategory === category;
              const isColorPicking = colorPickerCategory === category;

              return (
                <div key={category} className="space-y-1">
                  <div className="flex items-center gap-2">
                    {/* 카테고리 버튼 - 편집 화면 스타일 */}
                    <button
                      onClick={() => handleToggleCategory(category)}
                      disabled={(!canSelect && !isSelected) || (!canDeselect && isSelected)}
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
                            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                            if (e.key === 'Enter') handleNameChange(category);
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

                    {/* 체크 아이콘 - 버튼 오른쪽에 표시 */}
                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                      {isSelected && !isEditing && (
                        <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </span>
                      )}
                    </span>

                    {/* 편집 버튼들 - 나란히 배열 */}
                    {!isEditing && (
                      <div className="flex gap-0.5 flex-shrink-0">
                        {onUpdateCategoryName && (
                          <button
                            onClick={() => startEditing(category)}
                            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            title="이름 변경"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onUpdateCategoryColor && (
                          <button
                            onClick={() => setColorPickerCategory(isColorPicking ? null : category)}
                            className={cn(
                              "p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors",
                              isColorPicking && "bg-accent/50 text-foreground"
                            )}
                            title="색상 변경"
                          >
                            <Palette className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteCategory && (
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            className={cn(
                              'p-1 rounded transition-colors',
                              usageCount > 0
                                ? 'text-muted-foreground/40 cursor-not-allowed'
                                : 'hover:bg-destructive/20 text-muted-foreground hover:text-destructive'
                            )}
                            title={usageCount > 0 ? `${usageCount}개 목표에서 사용 중` : '삭제'}
                            disabled={usageCount > 0}
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
                      {/* 커스텀 색상 선택 */}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => handleColorChange(category, e.target.value)}
                          className="w-8 h-6 rounded cursor-pointer border-0"
                        />
                        <span className="text-xs text-muted-foreground">직접 선택</span>
                      </div>
                      {/* 프리셋 색상 */}
                      <div className="flex flex-wrap gap-1">
                        {PRESET_COLORS.map((presetColor) => (
                          <button
                            key={presetColor}
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
          </div>

          {/* 새 카테고리 추가 */}
          {onAddCategory && (
            <div className="pt-2 border-t">
              {showAddInput ? (
                <div className="flex gap-1">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="새 카테고리명"
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter') handleAddNewCategory();
                      if (e.key === 'Escape') {
                        setShowAddInput(false);
                        setNewCategoryName('');
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={handleAddNewCategory}
                    disabled={!newCategoryName.trim()}
                  >
                    추가
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => {
                      setShowAddInput(false);
                      setNewCategoryName('');
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddInput(true)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>새 카테고리 추가</span>
                </button>
              )}
            </div>
          )}

          {/* 저장 버튼 */}
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={isLoading || selectedCategories.length === 0}
              className="w-full h-8"
              size="sm"
            >
              {isLoading ? '저장 중...' : '저장'}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
