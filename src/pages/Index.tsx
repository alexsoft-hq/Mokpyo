import { useState, useEffect, useMemo } from 'react';
import { Goal, GoalCategory } from '@/types/goal';
import { OverallSummary } from '@/components/OverallSummary';
import { CompactOverallSummary } from '@/components/CompactOverallSummary';
import { GoalCard } from '@/components/GoalCard';
import { CompactGoalCard } from '@/components/CompactGoalCard';
import { GoalDetailModal } from '@/components/GoalDetailModal';
import { GoalViewDialog } from '@/components/GoalViewDialog';
import { AddGoalModal } from '@/components/AddGoalModal';
import { SettingsDialog } from '@/components/SettingsDialog';
import { Button } from '@/components/ui/button';
import { Plus, Target, SearchX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
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
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { api, Cycle } from '@/lib/api';
import { RegisteredUser } from '@/components/OwnerInput';
import { useUserSettings, ViewMode } from '@/hooks/useUserSettings';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useProject } from '@/contexts/ProjectContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { useSampleData } from '@/components/onboarding/useSampleData';
import { useSearchParams } from 'react-router-dom';

const Index = () => {
  const { user, logout, updateUser } = useAuth();
  const { currentOrganization } = useWorkspace();
  const isAdminOrOwner = currentOrganization?.role === 'OWNER' || currentOrganization?.role === 'ADMIN';
  const { settings: userSettings, updateSettings: updateUserSettings } = useUserSettings();
  const { currentProject, includeDescendants, projects, projectTree, setCurrentProject } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loadSample, loading: sampleLoading } = useSampleData();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<GoalCategory[]>([]);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({});
  const [searchText, setSearchText] = useState('');
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<GoalCategory[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(userSettings.defaultViewMode);
  const [showCompleted, setShowCompleted] = useState(userSettings.showCompletedByDefault);
  const [showOnHold, setShowOnHold] = useState(false);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [onHoldCount, setOnHoldCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load categories and goals from API
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (!currentProject) {
        console.log('Index: No current project, setting isLoading to false');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Load categories, goals, users, and cycles
        const [categoriesData, allGoalsData, usersData, cyclesData] = await Promise.all([
          api.getCategories(currentProject.id, includeDescendants),
          api.getGoals(currentProject.id, true, includeDescendants),
          api.getUsers().catch(() => [] as RegisteredUser[]),
          api.getCycles().catch(() => [] as Cycle[]),
        ]);

        if (cancelled) return;

        setRegisteredUsers(usersData);
        setCycles(cyclesData);

        const categoryNames = categoriesData.map((c) => c.name);
        const colors: Record<string, string> = {};
        const ids: Record<string, string> = {};

        categoriesData.forEach((c) => {
          colors[c.name] = c.color;
          ids[c.name] = c.id;
        });

        setCategories(categoryNames);
        setSelectedCategories(categoryNames);
        setCategoryColors(colors);
        setCategoryIds(ids);

        // Load all goals (always load all, filtering will be done client-side)
        const completed = allGoalsData.filter(g => g.completed).length;
        setCompletedCount(completed);
        setOnHoldCount(allGoalsData.filter(g => g.onHold).length);
        setGoals(allGoalsData);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load data:', error);
        // Fallback to default data
        const defaultCategories = ['SERVICE', 'AI', 'OPERATIONS'];
        setCategories(defaultCategories);
        setSelectedCategories(defaultCategories);
        setCategoryColors({
          'SERVICE': '#3b82f6',
          'AI': '#8b5cf6',
          'OPERATIONS': '#10b981'
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [currentProject?.id, includeDescendants]);

  // Background data refresh - only when safe to update
  useEffect(() => {
    // Skip if auto refresh is disabled
    if (!userSettings.enableAutoRefresh) {
      return;
    }

    // Skip if no current project
    if (!currentProject) {
      return;
    }

    let cancelled = false;
    const refreshIntervalMs = userSettings.autoRefreshInterval * 1000;

    const refreshData = async () => {
      // Skip refresh if user is actively editing or viewing
      if (isViewDialogOpen || isDetailModalOpen || isAddModalOpen || isSettingsOpen || isDragging) {
        return;
      }

      // Skip refresh if tab is not visible
      if (document.hidden) {
        return;
      }

      try {
        const allGoalsData = await api.getGoals(currentProject.id, true, includeDescendants);
        if (cancelled) return;
        setCompletedCount(allGoalsData.filter(g => g.completed).length);
        setOnHoldCount(allGoalsData.filter(g => g.onHold).length);
        setGoals(allGoalsData);
        console.log('Background refresh completed');
      } catch (error) {
        if (cancelled) return;
        console.error('Background refresh failed:', error);
      }
    };

    // Initial delay before first refresh
    const initialTimeout = setTimeout(() => {
      refreshData();
    }, refreshIntervalMs);

    // Set up interval for subsequent refreshes
    const refreshInterval = setInterval(refreshData, refreshIntervalMs);

    // Cleanup both timeout and interval
    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      clearInterval(refreshInterval);
    };
  }, [currentProject, includeDescendants, isViewDialogOpen, isDetailModalOpen, isAddModalOpen, isSettingsOpen, isDragging, userSettings.enableAutoRefresh, userSettings.autoRefreshInterval]);

  // Filter and sort goals (for card views - excludes completed if showCompleted is false)
  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      // Completed filter (only for card views, not list view)
      if (!showCompleted && goal.completed) {
        return false;
      }
      // OnHold filter
      if (!showOnHold && goal.onHold) {
        return false;
      }

      // Cycle filter (선택된 사이클이 있으면 해당 사이클 목표만)
      if (selectedCycleId && goal.cycleId !== selectedCycleId) {
        return false;
      }

      // My goals filter (담당자 목록에 현재 사용자 이름이 포함된 목표만)
      if (showMineOnly) {
        const goalOwners = goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner];
        if (!user || !goalOwners.includes(user.name)) return false;
      }

      // Category filter
      if (!goal.categories || !goal.categories.some(cat => selectedCategories.includes(cat))) {
        return false;
      }

      // Owner filter - if any owners selected, goal must have at least one matching owner
      if (selectedOwners.length > 0) {
        const goalOwners = goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner];
        if (!goalOwners.some(o => selectedOwners.includes(o))) return false;
      }

      // Search filter
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesTitle = goal.title.toLowerCase().includes(searchLower);
        const matchesDesc = goal.description?.toLowerCase().includes(searchLower);
        const goalOwners = goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner];
        const matchesOwner = goalOwners.some(o => o.toLowerCase().includes(searchLower));

        return matchesTitle || matchesDesc || matchesOwner;
      }

      return true;
    }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [goals, selectedCategories, selectedOwners, searchText, showCompleted, showOnHold, showMineOnly, selectedCycleId, user]);

  // "내 목표" 카운트 (담당자에 현재 사용자 이름 포함)
  const mineCount = useMemo(() => {
    if (!user) return 0;
    return goals.filter((g) => {
      const o = g.owners && g.owners.length > 0 ? g.owners : [g.owner];
      return o.includes(user.name);
    }).length;
  }, [goals, user]);

  // Calculate category usage count (how many goals use each category)
  const categoryUsageCount = useMemo(() => {
    const counts: Record<string, number> = {};
    goals.forEach((goal) => {
      if (goal.categories) {
        goal.categories.forEach((cat) => {
          counts[cat] = (counts[cat] || 0) + 1;
        });
      }
    });
    return counts;
  }, [goals]);

  // Get unique owners from main goals only (filtered by category and search, excluding owner filter)
  const owners = useMemo(() => {
    const ownerSet = new Set<string>();
    goals.forEach((goal) => {
      // Apply same filters as filteredGoals except owner filter
      if (!goal.categories || !goal.categories.some(cat => selectedCategories.includes(cat))) {
        return;
      }

      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesTitle = goal.title.toLowerCase().includes(searchLower);
        const matchesDesc = goal.description?.toLowerCase().includes(searchLower);
        const goalOwners = goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner];
        const matchesOwner = goalOwners.some(o => o.toLowerCase().includes(searchLower));

        if (!matchesTitle && !matchesDesc && !matchesOwner) {
          return;
        }
      }

      // Add all owners from owners array
      const goalOwners = goal.owners && goal.owners.length > 0 ? goal.owners : [goal.owner];
      goalOwners.forEach(o => ownerSet.add(o));
    });
    return Array.from(ownerSet).sort();
  }, [goals, selectedCategories, searchText]);

  // All unique owners across all goals (for autocomplete suggestions)
  const existingOwners = useMemo(() => {
    const ownerSet = new Set<string>();
    goals.forEach((goal) => {
      const goalOwners = goal.owners && goal.owners.length > 0 ? goal.owners : (goal.owner ? [goal.owner] : []);
      goalOwners.forEach(o => ownerSet.add(o));
      goal.subGoals?.forEach((sub) => {
        const sgOwners = sub.owners && sub.owners.length > 0 ? sub.owners : (sub.owner ? [sub.owner] : []);
        sgOwners.forEach(o => ownerSet.add(o));
      });
    });
    return Array.from(ownerSet).sort();
  }, [goals]);

  const handleCategoryToggle = (category: GoalCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleOwnerToggle = (owner: string) => {
    setSelectedOwners((prev) =>
      prev.includes(owner)
        ? prev.filter((o) => o !== owner)
        : [...prev, owner]
    );
  };

  const handleSaveGoal = async (updatedGoal: Goal) => {
    try {
      console.log('Saving goal with version:', updatedGoal.version);
      await api.updateGoal(updatedGoal.id, updatedGoal);

      // Always refresh all goals after save to ensure all users see latest data
      // IMPORTANT: Always fetch ALL goals (true), filtering is done client-side
      if (!currentProject) return;
      const allGoalsData = await api.getGoals(currentProject.id, true, includeDescendants);
      setCompletedCount(allGoalsData.filter(g => g.completed).length);
      setOnHoldCount(allGoalsData.filter(g => g.onHold).length);
      setGoals(allGoalsData);

      // Update selectedGoal with latest data for ViewDialog
      const savedGoal = allGoalsData.find(g => g.id === updatedGoal.id);
      if (savedGoal) {
        setSelectedGoal(savedGoal);
      }
    } catch (error: any) {
      console.error('Failed to save goal:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);

      // Handle conflict (409)
      if (error.response?.status === 409) {
        const shouldReload = confirm(
          '다른 사용자가 이 목표를 수정했습니다.\n' +
          '현재 화면을 새로고침하여 최신 데이터를 불러오시겠습니까?\n\n' +
          '"확인"을 누르면 새로고침되며, 작성 중인 내용은 손실됩니다.'
        );

        if (shouldReload) {
          // Close the modal
          setSelectedGoal(null);

          // Reload all goals to get the latest data
          // IMPORTANT: Always fetch ALL goals (true), filtering is done client-side
          if (!currentProject) return;
          const allGoalsData = await api.getGoals(currentProject.id, true, includeDescendants);
          setCompletedCount(allGoalsData.filter(g => g.completed).length);
          setOnHoldCount(allGoalsData.filter(g => g.onHold).length);
          setGoals(allGoalsData);
        }

        throw new Error('목표가 다른 사용자에 의해 수정되었습니다.');
      }

      alert('목표 저장에 실패했습니다.');
      throw error;
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await api.deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      // Close dialogs after delete
      setIsViewDialogOpen(false);
      setSelectedGoal(null);
    } catch (error) {
      console.error('Failed to delete goal:', error);
      alert('목표 삭제에 실패했습니다.');
      throw error; // 모달이 닫히지 않고 유지되도록 재전파(성공 시에만 닫힘)
    }
  };

  const handleToggleComplete = async (goalId: string, completed: boolean) => {
    if (!currentProject) return;

    try {
      await api.toggleGoalCompletion(goalId, completed);

      // Reload all goals and update completed count
      const allGoalsData = await api.getGoals(currentProject.id, true, includeDescendants);
      const completedTotal = allGoalsData.filter(g => g.completed).length;
      setCompletedCount(completedTotal);
      setOnHoldCount(allGoalsData.filter(g => g.onHold).length);
      setGoals(allGoalsData);

      // Update selectedGoal if viewing this goal
      if (selectedGoal && selectedGoal.id === goalId) {
        const updatedGoal = allGoalsData.find(g => g.id === goalId);
        if (updatedGoal) {
          setSelectedGoal(updatedGoal);
        }
      }
    } catch (error) {
      console.error('Failed to toggle goal completion:', error);
      alert('목표 완료 상태 변경에 실패했습니다.');
    }
  };

  const handleToggleOnHold = async (goalId: string, onHold: boolean) => {
    if (!currentProject) return;

    try {
      await api.toggleGoalOnHold(goalId, onHold);

      // Reload all goals and update counts
      const allGoalsData = await api.getGoals(currentProject.id, true, includeDescendants);
      setCompletedCount(allGoalsData.filter(g => g.completed).length);
      setOnHoldCount(allGoalsData.filter(g => g.onHold).length);
      setGoals(allGoalsData);

      // Update selectedGoal if viewing this goal
      if (selectedGoal && selectedGoal.id === goalId) {
        const updatedGoal = allGoalsData.find(g => g.id === goalId);
        if (updatedGoal) {
          setSelectedGoal(updatedGoal);
        }
      }
    } catch (error) {
      console.error('Failed to toggle goal on-hold:', error);
      alert('목표 보류 상태 변경에 실패했습니다.');
    }
  };

  const handleQuickCategoryUpdate = async (goalId: string, newCategories: GoalCategory[]) => {
    if (!currentProject) return;

    try {
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return;

      // 카테고리만 업데이트
      await api.updateGoal(goalId, { ...goal, categories: newCategories });

      // 목표 목록 새로고침
      const allGoalsData = await api.getGoals(currentProject.id, true, includeDescendants);
      setCompletedCount(allGoalsData.filter(g => g.completed).length);
      setOnHoldCount(allGoalsData.filter(g => g.onHold).length);
      setGoals(allGoalsData);

      // selectedGoal 업데이트
      if (selectedGoal && selectedGoal.id === goalId) {
        const updatedGoal = allGoalsData.find(g => g.id === goalId);
        if (updatedGoal) {
          setSelectedGoal(updatedGoal);
        }
      }
    } catch (error) {
      console.error('Failed to update goal categories:', error);
      alert('카테고리 변경에 실패했습니다.');
      throw error;
    }
  };

  const handleAddGoal = async (newGoal: Goal) => {
    if (!currentProject) return;

    try {
      const maxOrder = Math.max(...goals.map((g) => g.order ?? 0), -1);
      const goalWithOrder = { ...newGoal, projectId: currentProject.id, order: maxOrder + 1 };
      const createdGoal = await api.createGoal(goalWithOrder);
      setGoals((prev) => [...prev, createdGoal]);
    } catch (error) {
      console.error('Failed to add goal:', error);
      alert('목표 추가에 실패했습니다.');
    }
  };

  const handleAddCategory = async (newCategory: string) => {
    if (!currentProject || !newCategory.trim() || categories.includes(newCategory.trim())) return;
    const trimmedCategory = newCategory.trim();

    try {
      const category = await api.createCategory(trimmedCategory, '#6b7280', currentProject.id);
      setCategories((prev) => [...prev, trimmedCategory]);
      setSelectedCategories((prev) => [...prev, trimmedCategory]);
      setCategoryColors((prev) => ({ ...prev, [trimmedCategory]: '#6b7280' }));
      setCategoryIds((prev) => ({ ...prev, [trimmedCategory]: category.id }));
    } catch (error) {
      console.error('Failed to add category:', error);
      alert('카테고리 추가에 실패했습니다.');
    }
  };

  const handleCategoryColorChange = async (category: string, color: string) => {
    try {
      const categoryId = categoryIds[category];
      if (categoryId) {
        await api.updateCategoryColor(categoryId, color);
        setCategoryColors((prev) => ({ ...prev, [category]: color }));
      }
    } catch (error) {
      console.error('Failed to update category color:', error);
      alert('카테고리 색상 변경에 실패했습니다.');
    }
  };

  const handleCategoryNameChange = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;

    try {
      const categoryId = categoryIds[oldName];
      if (categoryId) {
        await api.updateCategoryName(categoryId, newName);

        // Update categories list
        setCategories((prev) => prev.map((c) => c === oldName ? newName : c));

        // Update selected categories
        setSelectedCategories((prev) => prev.map((c) => c === oldName ? newName : c));

        // Update category colors map
        const oldColor = categoryColors[oldName];
        setCategoryColors((prev) => {
          const updated = { ...prev };
          delete updated[oldName];
          updated[newName] = oldColor;
          return updated;
        });

        // Update category IDs map
        setCategoryIds((prev) => {
          const updated = { ...prev };
          delete updated[oldName];
          updated[newName] = categoryId;
          return updated;
        });

        // Update goals that use this category
        setGoals((prev) => prev.map((g) =>
          g.categories && g.categories.includes(oldName)
            ? { ...g, categories: g.categories.map(c => c === oldName ? newName : c) }
            : g
        ));
      }
    } catch (error) {
      console.error('Failed to update category name:', error);
      alert('카테고리 이름 변경에 실패했습니다.');
    }
  };

  const handleDeleteCategory = async (categoryToDelete: string) => {
    // Don't allow deletion if goals exist with this category
    const hasGoalsWithCategory = goals.some((g) => g.categories && g.categories.includes(categoryToDelete));
    if (hasGoalsWithCategory) {
      alert('이 카테고리를 사용하는 목표가 있어 삭제할 수 없습니다.');
      return;
    }

    try {
      const categoryId = categoryIds[categoryToDelete];
      if (categoryId) {
        await api.deleteCategory(categoryId);
        setCategories((prev) => prev.filter((c) => c !== categoryToDelete));
        setSelectedCategories((prev) => prev.filter((c) => c !== categoryToDelete));
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('카테고리 삭제에 실패했습니다.');
    }
  };


  const refreshCycles = async () => {
    try {
      const cyclesData = await api.getCycles();
      setCycles(cyclesData);
      // 현재 필터 중인 사이클이 삭제됐으면 전체로 리셋(유령 필터 방지)
      setSelectedCycleId((prev) => (prev && !cyclesData.some((c) => c.id === prev) ? '' : prev));
    } catch (error) {
      console.error('Failed to refresh cycles:', error);
    }
  };

  // 사이클 일괄 배정 등 외부 변경 후 현재 프로젝트의 목표 목록 재조회
  const refreshGoals = async () => {
    if (!currentProject) return;
    try {
      const allGoalsData = await api.getGoals(currentProject.id, true, includeDescendants);
      setCompletedCount(allGoalsData.filter(g => g.completed).length);
      setOnHoldCount(allGoalsData.filter(g => g.onHold).length);
      setGoals(allGoalsData);
    } catch (error) {
      console.error('Failed to refresh goals:', error);
    }
  };

  const handleCardClick = async (goal: Goal) => {
    // Clear previous selection first
    setSelectedGoal(null);
    setIsViewDialogOpen(true);

    try {
      // Fetch latest data from server
      console.log('Fetching latest goal data for:', goal.id);
      const latestGoal = await api.getGoal(goal.id);
      console.log('Received latest goal:', latestGoal);

      // Update the goal in the list as well
      setGoals((prev) =>
        prev.map((g) => (g.id === latestGoal.id ? latestGoal : g))
      );

      setSelectedGoal(latestGoal);
    } catch (error) {
      console.error('Failed to fetch goal details:', error);
      // Fallback to cached data
      setSelectedGoal(goal);
    }
  };

  const handleEditFromView = () => {
    // Close view dialog and open edit modal
    setIsViewDialogOpen(false);
    setIsDetailModalOpen(true);
  };

  // 딥링크 소비: ?item=<goalId> (또는 legacy ?goalId=) → 기존 GoalViewDialog 열기.
  // 테이블/보드/활동피드에서 넘어온 링크를 카드 페이지에서 처리. 파라미터 없으면 오늘과 동작 동일.
  const itemParam = searchParams.get('item') || searchParams.get('goalId');
  useEffect(() => {
    if (!itemParam) return;
    if (selectedGoal?.id === itemParam && isViewDialogOpen) return;
    handleCardClick({ id: itemParam } as Goal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemParam]);

  // 명령 팔레트·단축키(n)에서 넘어온 ?new=1 → 새 목표 모달을 열고 파라미터를 지운다.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setIsAddModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // 빈 상태에서 '필터 초기화' — 검색·담당자·분류·사이클·내 목표를 모두 되돌린다.
  const resetFilters = () => {
    setSearchText('');
    setSelectedOwners([]);
    setSelectedCategories(categories);
    setSelectedCycleId('');
    setShowMineOnly(false);
    setShowCompleted(true);
    setShowOnHold(true);
  };

  const handleCloseView = () => {
    setIsViewDialogOpen(false);
    setSelectedGoal(null);
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setGoals((allGoals) => {
        // Find indices in the full goals array (not filtered)
        const oldIndex = allGoals.findIndex((item) => item.id === active.id);
        const newIndex = allGoals.findIndex((item) => item.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return allGoals;

        // Reorder the full array
        const reordered = arrayMove(allGoals, oldIndex, newIndex);

        // Update order property for all goals to match their new positions
        const updatedGoals = reordered.map((goal, index) => ({ ...goal, order: index }));

        // Save new order to API (only send goals that changed order)
        api.reorderGoals(
          updatedGoals.map((g) => ({ id: g.id, order: g.order ?? 0 }))
        ).catch((error) => {
          console.error('Failed to save order:', error);
          alert('순서 저장에 실패했습니다.');
        });

        return updatedGoals;
      });
    }
  };

  const { isLoading: projectsLoading, createProject } = useProject();

  if (isLoading || projectsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  // If no projects exist, show a welcome screen
  if (!currentProject && projects.length === 0) {
    return (
      <>
        <AppHeader showProjectSelector={false} />
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold mb-4">프로젝트가 없습니다</h1>
            <p className="text-muted-foreground mb-6">
              시작하려면 첫 번째 프로젝트를 생성하세요.
            </p>
            <Button
              onClick={async () => {
                const name = prompt('프로젝트 이름을 입력하세요:', 'My First Project');
                if (name) {
                  try {
                    await createProject({ name, description: '' });
                  } catch (error) {
                    console.error('Failed to create project:', error);
                    alert('프로젝트 생성에 실패했습니다.');
                  }
                }
              }}
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              첫 프로젝트 만들기
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader showTabs />
      <div className="min-h-screen bg-background">
      <div className="w-full px-6 py-6">
        {viewMode === 'normal' ? (
          <OverallSummary
            goals={goals}
            filteredGoals={filteredGoals}
            onAddGoal={() => setIsAddModalOpen(true)}
            categoryColors={categoryColors}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            searchText={searchText}
            onSearchChange={setSearchText}
            selectedOwners={selectedOwners}
            onOwnerToggle={handleOwnerToggle}
            selectedCategories={selectedCategories}
            onCategoryToggle={handleCategoryToggle}
            owners={owners}
            categories={categories}
            showCompleted={showCompleted}
            onShowCompletedToggle={() => setShowCompleted(!showCompleted)}
            completedCount={completedCount}
            showOnHold={showOnHold}
            onShowOnHoldToggle={() => setShowOnHold(!showOnHold)}
            onHoldCount={onHoldCount}
            showMineOnly={showMineOnly}
            onShowMineToggle={() => setShowMineOnly(!showMineOnly)}
            mineCount={mineCount}
            onSettingsClick={isAdminOrOwner ? () => setIsSettingsOpen(true) : undefined}
            user={user}
            onLogout={logout}
            onUserUpdate={updateUser}
            cycles={cycles}
            selectedCycleId={selectedCycleId}
            onCycleChange={setSelectedCycleId}
            canManageCycles={isAdminOrOwner}
            onCyclesChange={refreshCycles}
            onGoalsChange={refreshGoals}
          />
        ) : (
          <CompactOverallSummary
            goals={goals}
            onAddGoal={() => setIsAddModalOpen(true)}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            categoryColors={categoryColors}
            selectedCategories={selectedCategories}
            onCategoryToggle={handleCategoryToggle}
            showCompleted={showCompleted}
            onShowCompletedToggle={() => setShowCompleted(!showCompleted)}
            completedCount={completedCount}
            showOnHold={showOnHold}
            onShowOnHoldToggle={() => setShowOnHold(!showOnHold)}
            onHoldCount={onHoldCount}
            showMineOnly={showMineOnly}
            onShowMineToggle={() => setShowMineOnly(!showMineOnly)}
            mineCount={mineCount}
            onSettingsClick={isAdminOrOwner ? () => setIsSettingsOpen(true) : undefined}
            user={user}
            onLogout={logout}
            onUserUpdate={updateUser}
            searchText={searchText}
            onSearchChange={setSearchText}
            selectedOwners={selectedOwners}
            onOwnerToggle={handleOwnerToggle}
            owners={owners}
            cycles={cycles}
            selectedCycleId={selectedCycleId}
            onCycleChange={setSelectedCycleId}
            canManageCycles={isAdminOrOwner}
            onCyclesChange={refreshCycles}
            onGoalsChange={refreshGoals}
          />
        )}

        <OnboardingChecklist
          goalCount={goals.length}
          onAddGoal={() => setIsAddModalOpen(true)}
          className="mt-6"
        />

        {/* 목록보기(ListView)는 /table 뷰와 중복되어 제거 — 카드 그리드만 렌더 */}
        <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredGoals.map((goal) => goal.id)}
                strategy={rectSortingStrategy}
              >
                <div className={viewMode === 'compact'
                  ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 auto-rows-auto"
                  : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-auto"
                }>
                  {filteredGoals.map((goal) => (
                    viewMode === 'compact' ? (
                      <CompactGoalCard
                        key={goal.id}
                        goal={goal}
                        onClick={() => handleCardClick(goal)}
                        categories={categories}
                        categoryColors={categoryColors}
                        onToggleComplete={handleToggleComplete}
                        onToggleOnHold={handleToggleOnHold}
                        onUpdateCategories={handleQuickCategoryUpdate}
                        onAddCategory={handleAddCategory}
                        onUpdateCategoryColor={handleCategoryColorChange}
                        onUpdateCategoryName={handleCategoryNameChange}
                        onDeleteCategory={handleDeleteCategory}
                        categoryUsageCount={categoryUsageCount}
                        registeredUsers={registeredUsers}
                      />
                    ) : (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        onClick={() => handleCardClick(goal)}
                        categories={categories}
                        categoryColors={categoryColors}
                        onToggleComplete={handleToggleComplete}
                        onToggleOnHold={handleToggleOnHold}
                        onUpdateCategories={handleQuickCategoryUpdate}
                        onAddCategory={handleAddCategory}
                        onUpdateCategoryColor={handleCategoryColorChange}
                        onUpdateCategoryName={handleCategoryNameChange}
                        onDeleteCategory={handleDeleteCategory}
                        categoryUsageCount={categoryUsageCount}
                        registeredUsers={registeredUsers}
                      />
                    )
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {filteredGoals.length === 0 && (
              goals.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="첫 목표를 만들어 보세요"
                  description="목표를 하나 추가하면 카드·테이블·보드·타임라인에서 같은 목표를 다르게 볼 수 있습니다."
                  primaryAction={{ label: '새 목표', onClick: () => setIsAddModalOpen(true) }}
                  secondaryAction={{ label: '샘플 데이터로 둘러보기', onClick: loadSample, loading: sampleLoading }}
                />
              ) : (
                <EmptyState
                  icon={SearchX}
                  title="조건에 맞는 목표가 없습니다"
                  description="검색어나 필터를 바꾸면 다른 목표를 볼 수 있습니다."
                  primaryAction={{ label: '필터 초기화', onClick: resetFilters }}
                />
              )
            )}
          </>
      </div>

      <GoalViewDialog
        goal={selectedGoal}
        open={isViewDialogOpen}
        onClose={handleCloseView}
        onEdit={handleEditFromView}
        onToggleComplete={handleToggleComplete}
        onToggleOnHold={handleToggleOnHold}
        categories={categories}
        categoryColors={categoryColors}
        registeredUsers={registeredUsers}
        projects={projects}
        projectTree={projectTree}
        currentProjectId={currentProject?.id || ''}
        onCopySuccess={(newGoal, targetProjectId) => {
          // Close view dialog
          setIsViewDialogOpen(false);
          setSelectedGoal(null);
          // Navigate to target project
          const targetProject = projects.find(p => p.id === targetProjectId);
          if (targetProject) {
            setCurrentProject(targetProject);
            // The goal list will refresh automatically when project changes
          }
        }}
      />

      <GoalDetailModal
        goal={selectedGoal}
        canDelete={isAdminOrOwner}
        open={isDetailModalOpen}
        onClose={async () => {
          setIsDetailModalOpen(false);
          // Re-open view dialog with updated data after edit
          if (selectedGoal) {
            try {
              // Fetch latest data from server
              const latestGoal = await api.getGoal(selectedGoal.id);
              setSelectedGoal(latestGoal);
              // Update in goals list as well
              setGoals((prev) =>
                prev.map((g) => (g.id === latestGoal.id ? latestGoal : g))
              );
            } catch (error) {
              console.error('Failed to refresh goal:', error);
            }
            setIsViewDialogOpen(true);
          }
        }}
        onSave={handleSaveGoal}
        onDelete={handleDeleteGoal}
        categories={categories}
        categoryColors={categoryColors}
        registeredUsers={registeredUsers}
        existingOwners={existingOwners}
        cycles={cycles}
        goals={goals}
      />

      <AddGoalModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddGoal}
        categories={categories}
        categoryColors={categoryColors}
        registeredUsers={registeredUsers}
        existingOwners={existingOwners}
        onAddCategory={handleAddCategory}
        onUpdateCategoryColor={handleCategoryColorChange}
        onUpdateCategoryName={handleCategoryNameChange}
        onDeleteCategory={handleDeleteCategory}
        cycles={cycles}
        goals={goals}
      />

      {/* Copyright */}
      <div className="mt-8 py-6 text-center text-xs text-muted-foreground opacity-60 pointer-events-none select-none sm:fixed sm:bottom-4 sm:right-4 sm:mt-0 sm:py-0 sm:text-right">
        Copyright © L.Y.M & J.J.A. All rights reserved.
      </div>
      </div>
    </>
  );
};

export default Index;
