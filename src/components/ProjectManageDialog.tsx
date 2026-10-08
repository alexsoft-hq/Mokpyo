import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Project } from '@/types/goal';
import { ProjectTree } from '@/components/ProjectTree';
import { ProjectInfoPanel } from '@/components/ProjectInfoPanel';
import { ProjectTreeSelect } from '@/components/ProjectTreeSelect';
import { X, ArrowLeft } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ProjectManageDialogProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  projectTree: Project[];
  currentProject: Project | null;
  onCreateProject: (project: { name: string; description?: string; parentId?: string | null }) => Promise<void>;
  onUpdateProject: (id: string, project: { name?: string; description?: string; parentId?: string | null }) => Promise<void>;
  onDeleteProject: (id: string, confirmName: string) => Promise<void>;
  onSelectProject: (project: Project) => void;
}

export const ProjectManageDialog = ({
  open,
  onClose,
  projects,
  projectTree,
  currentProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onSelectProject,
}: ProjectManageDialogProps) => {
  const { currentOrganization } = useWorkspace();
  const isAdminOrOwner = currentOrganization?.role === 'OWNER' || currentOrganization?.role === 'ADMIN';
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [mode, setMode] = useState<'tree' | 'create'>('tree');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // 다이얼로그 열릴 때 현재 프로젝트 선택
  useEffect(() => {
    if (open) {
      setSelectedProject(currentProject);
      setMode('tree');
    }
  }, [open, currentProject]);

  // 선택된 프로젝트의 부모 프로젝트 찾기
  const findParentProject = (project: Project | null): Project | null => {
    if (!project || !project.parentId) return null;
    return projects.find(p => p.id === project.parentId) || null;
  };

  const handleSelect = (project: Project) => {
    setSelectedProject(project);
  };

  const handleMove = async (projectId: string, newParentId: string | null) => {
    try {
      await onUpdateProject(projectId, { parentId: newParentId });
      // 선택된 프로젝트가 이동된 경우 업데이트
      if (selectedProject?.id === projectId) {
        const updated = projects.find(p => p.id === projectId);
        if (updated) {
          setSelectedProject({ ...updated, parentId: newParentId });
        }
      }
    } catch (error: any) {
      console.error('Failed to move project:', error);
      if (error.message?.includes('circular reference')) {
        alert('순환 참조가 발생합니다. 다른 위치로 이동해주세요.');
      } else {
        alert('프로젝트 이동에 실패했습니다.');
      }
    }
  };

  const handleUpdate = async (id: string, data: { name?: string; description?: string }) => {
    await onUpdateProject(id, data);
    // 업데이트 후 선택된 프로젝트 갱신
    const updated = projects.find(p => p.id === id);
    if (updated && selectedProject?.id === id) {
      setSelectedProject({ ...updated, ...data });
    }
  };

  const handleDelete = async (id: string, confirmName: string) => {
    await onDeleteProject(id, confirmName);
    // 삭제 후 선택 해제
    if (selectedProject?.id === id) {
      setSelectedProject(null);
    }
  };

  const handleCreateNew = () => {
    setNewName('');
    setNewDescription('');
    setNewParentId(selectedProject?.id || null);
    setMode('create');
  };

  const handleCreateSubmit = async () => {
    if (!newName.trim()) {
      alert('프로젝트 이름을 입력해주세요.');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateProject({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        parentId: newParentId,
      });
      setMode('tree');
      setNewName('');
      setNewDescription('');
      setNewParentId(null);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('프로젝트 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateCancel = () => {
    setMode('tree');
    setNewName('');
    setNewDescription('');
    setNewParentId(null);
  };

  const handleProjectDoubleClick = (project: Project) => {
    onSelectProject(project);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[600px] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>
              {mode === 'tree' ? '프로젝트 관리' : '새 프로젝트 추가'}
            </DialogTitle>
          </div>
        </DialogHeader>

        {mode === 'tree' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* 좌측: 트리 뷰 */}
            <div className="w-1/2 border-r flex flex-col">
              <div className="px-4 py-2 border-b bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  드래그 앤 드롭으로 구조 변경 / 클릭으로 선택
                </p>
              </div>
              <div className="flex-1 overflow-hidden">
                <ProjectTree
                  projects={projects}
                  projectTree={projectTree}
                  selectedId={selectedProject?.id || null}
                  onSelect={handleSelect}
                  onMove={handleMove}
                  onCreateNew={handleCreateNew}
                />
              </div>
            </div>

            {/* 우측: 정보 패널 */}
            <div className="w-1/2 flex flex-col">
              <ProjectInfoPanel
                project={selectedProject}
                parentProject={findParentProject(selectedProject)}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onRemoveParent={async (id) => {
                  await handleMove(id, null);
                }}
                canDelete={isAdminOrOwner && projects.length > 1}
              />

              {/* 대시보드로 이동 버튼 */}
              {selectedProject && (
                <div className="px-4 pb-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleProjectDoubleClick(selectedProject)}
                  >
                    이 프로젝트 대시보드로 이동
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 새 프로젝트 생성 폼 */
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-md mx-auto space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreateCancel}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                뒤로
              </Button>

              <div className="space-y-2">
                <Label htmlFor="newProjectName">프로젝트 이름 *</Label>
                <Input
                  id="newProjectName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: Mokpyo"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newProjectDescription">설명</Label>
                <Textarea
                  id="newProjectDescription"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="예: 제품 개발 > 플랫폼 팀"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>부모 프로젝트</Label>
                <ProjectTreeSelect
                  projects={projectTree}
                  value={newParentId}
                  onChange={setNewParentId}
                  placeholder="부모 프로젝트 선택 (선택사항)"
                />
                <p className="text-xs text-muted-foreground">
                  선택하지 않으면 최상위 프로젝트로 생성됩니다.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleCreateCancel}
                  disabled={isCreating}
                >
                  취소
                </Button>
                <Button onClick={handleCreateSubmit} disabled={isCreating}>
                  {isCreating ? '생성 중...' : '생성'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
