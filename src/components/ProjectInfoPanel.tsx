import { t, useTranslation } from '@/i18n';
import { useState, useEffect } from 'react';
import { Project } from '@/types/goal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Folder, Trash2, Save, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProjectInfoPanelProps {
  project: Project | null;
  parentProject: Project | null;
  onUpdate: (id: string, data: { name?: string; description?: string }) => Promise<void>;
  onDelete: (id: string, confirmName: string) => Promise<void>;
  onRemoveParent: (id: string) => Promise<void>;
  canDelete: boolean;
}

export function ProjectInfoPanel({
  project,
  parentProject,
  onUpdate,
  onDelete,
  onRemoveParent,
  canDelete,
}: ProjectInfoPanelProps) {
  useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // 프로젝트 변경 시 폼 초기화
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setIsDirty(false);
    } else {
      setName('');
      setDescription('');
      setIsDirty(false);
    }
  }, [project?.id]);

  // 변경 감지
  useEffect(() => {
    if (!project) return;
    const hasChanges =
      name !== project.name ||
      description !== (project.description || '');
    setIsDirty(hasChanges);
  }, [name, description, project]);

  const handleSave = async () => {
    if (!project || !isDirty) return;

    if (!name.trim()) {
      alert(t("프로젝트 이름을 입력해주세요."));
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save project:', error);
      alert(t("프로젝트 저장에 실패했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setConfirmName('');
    setDeleteError('');
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!project) return;
    if (confirmName.trim() !== project.name) {
      setDeleteError(t("프로젝트 이름이 일치하지 않습니다."));
      return;
    }

    setIsDeleting(true);
    setDeleteError('');
    try {
      await onDelete(project.id, confirmName.trim());
      setDeleteConfirmOpen(false);
      setConfirmName('');
    } catch (error: any) {
      console.error('Failed to delete project:', error);
      const message: string = error?.message || '';
      if (message.includes('child project') || message.includes(t("하위 프로젝트"))) {
        setDeleteError(t("하위 프로젝트가 있어 삭제할 수 없습니다. 먼저 하위 프로젝트를 삭제하거나 이동해주세요."));
      } else {
        setDeleteError(message || t("프로젝트 삭제에 실패했습니다."));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t("프로젝트를 선택하세요")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-2 pb-2 border-b">
          <Folder className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold">{t("프로젝트 정보")}</h3>
        </div>

        {/* 이름 */}
        <div className="space-y-2">
          <Label htmlFor="projectName">{t("프로젝트 이름 *")}</Label>
          <Input
            id="projectName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("프로젝트 이름")}
          />
        </div>

        {/* 설명 */}
        <div className="space-y-2">
          <Label htmlFor="projectDescription">{t("설명")}</Label>
          <Textarea
            id="projectDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("프로젝트 설명 (선택사항)")}
            rows={3}
          />
        </div>

        {/* 부모 프로젝트 정보 */}
        <div className="space-y-2">
          <Label>{t("부모 프로젝트")}</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm px-3 py-2 bg-muted rounded-md">
              {parentProject ? (
                <span className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-amber-500" />
                  {parentProject.name}
                </span>
              ) : (
                <span className="text-muted-foreground">{t("없음 (최상위)")}</span>
              )}
            </div>
            {parentProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (project) {
                    try {
                      await onRemoveParent(project.id);
                    } catch (error) {
                      console.error('Failed to remove parent:', error);
                      alert(t("부모 제거에 실패했습니다."));
                    }
                  }
                }}
              >
                {t("부모 제거")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("트리에서 드래그 앤 드롭으로도 위치를 변경할 수 있습니다.")}
          </p>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex justify-between pt-4 border-t mt-4">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteClick}
          disabled={!canDelete || isSaving}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {t("삭제")}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {t("저장")}
        </Button>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("프로젝트 삭제")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div>
                  {t("{{name}} 프로젝트를 삭제하시겠습니까?", { name: project.name })}
                  <br />
                  <br />
                  <strong className="text-destructive">
                    {t("이 프로젝트의 모든 목표, 카테고리, 데이터가 영구적으로 삭제됩니다.")}
                  </strong>
                  <br />
                  {t("이 작업은 취소할 수 없습니다.")}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmProjectName" className="text-foreground">
                    {t("확인을 위해 프로젝트 이름을 입력하세요")}
                  </Label>
                  <Input
                    id="confirmProjectName"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={project.name}
                    disabled={isDeleting}
                    autoFocus
                  />
                  {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("취소")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting || confirmName.trim() !== project.name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("삭제 중...") : t("삭제")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
