import { useState } from 'react';
import { Goal, Project } from '@/types/goal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProjectTreeSelect } from '@/components/ProjectTreeSelect';
import { Copy, Check, X, Loader2, ArrowRight, FolderTree } from 'lucide-react';
import { api } from '@/lib/api';

interface GoalCopyDialogProps {
  goal: Goal | null;
  open: boolean;
  onClose: () => void;
  projects: Project[];
  projectTree: Project[];
  currentProjectId: string;
  onSuccess: (newGoal: Goal, targetProjectId: string) => void;
}

export const GoalCopyDialog = ({
  goal,
  open,
  onClose,
  projects,
  projectTree,
  currentProjectId,
  onSuccess,
}: GoalCopyDialogProps) => {
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    goal?: Goal;
    targetProjectName?: string;
    categoryMapping?: Record<string, { targetId: string; isNew: boolean; name: string }>;
  } | null>(null);

  const handleClose = () => {
    setTargetProjectId(null);
    setResult(null);
    onClose();
  };

  const handleCopy = async () => {
    if (!goal || !targetProjectId) return;

    setIsCopying(true);
    try {
      const response = await api.copyGoal(goal.id, targetProjectId);
      setResult({
        success: true,
        goal: response.goal,
        targetProjectName: response.targetProject,
        categoryMapping: response.categoryMapping,
      });
    } catch (error: any) {
      console.error('Failed to copy goal:', error);
      alert(error.message || '목표 복사에 실패했습니다.');
    } finally {
      setIsCopying(false);
    }
  };

  const handleViewCopied = () => {
    if (result?.goal && targetProjectId) {
      onSuccess(result.goal, targetProjectId);
      handleClose();
    }
  };

  if (!goal) return null;

  const subGoalsCount = goal.subGoals?.length || 0;
  const notesCount = goal.notes?.length || 0;
  const categoriesNames = goal.categories || [];
  const attachmentsCount = goal.attachments?.length || 0;

  // Find target project name
  const targetProject = projects.find(p => p.id === targetProjectId);

  // Count new categories that will be created
  const newCategoriesCount = result?.categoryMapping
    ? Object.values(result.categoryMapping).filter(m => m.isNew).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            목표 복사
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          // Copy form
          <div className="space-y-6 py-4">
            {/* Source info */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">복사할 목표</p>
              <p className="font-medium">{goal.title}</p>
            </div>

            {/* Target project selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">대상 프로젝트 *</label>
              <ProjectTreeSelect
                projects={projectTree}
                value={targetProjectId}
                onChange={setTargetProjectId}
                excludeIds={[currentProjectId]}
                placeholder="프로젝트 선택..."
              />
              <p className="text-xs text-muted-foreground">
                현재 프로젝트({projects.find(p => p.id === currentProjectId)?.name})는 선택할 수 없습니다.
              </p>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <p className="text-sm font-medium">복사 내용</p>
              <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1.5">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span>기본 정보 (제목, 설명, 진행률, 담당자 등)</span>
                </div>
                {subGoalsCount > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span>하위 목표 {subGoalsCount}개</span>
                  </div>
                )}
                {notesCount > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span>메모 {notesCount}개</span>
                  </div>
                )}
                {categoriesNames.length > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span>카테고리: {categoriesNames.join(', ')}</span>
                  </div>
                )}
                <div className="border-t my-2" />
                {attachmentsCount > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <X className="h-4 w-4" />
                    <span>첨부 파일 {attachmentsCount}개 (복사 안 됨)</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <X className="h-4 w-4" />
                  <span>변경 이력 (복사 안 됨)</span>
                </div>
              </div>
            </div>

            {/* Category note */}
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
              <p>
                <strong>카테고리 처리:</strong> 대상 프로젝트에 동일한 이름의 카테고리가 있으면 기존 카테고리를 사용하고, 없으면 새로 생성합니다.
              </p>
            </div>
          </div>
        ) : (
          // Success result
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-lg">복사 완료!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  "{goal.title}"이(가)<br />
                  "{result.targetProjectName}" 프로젝트에 복사되었습니다.
                </p>
              </div>
            </div>

            {/* Copy details */}
            {newCategoriesCount > 0 && (
              <div className="text-sm text-center text-muted-foreground">
                <FolderTree className="h-4 w-4 inline mr-1" />
                새 카테고리 {newCategoriesCount}개가 생성되었습니다.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isCopying}>
                취소
              </Button>
              <Button
                onClick={handleCopy}
                disabled={!targetProjectId || isCopying}
              >
                {isCopying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    복사 중...
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    복사하기
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                여기서 계속
              </Button>
              <Button onClick={handleViewCopied}>
                복사된 목표 보기
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
