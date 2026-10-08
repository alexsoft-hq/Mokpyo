import { useProject } from '@/contexts/ProjectContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ProjectManageDialog } from '@/components/ProjectManageDialog';
import { useState } from 'react';
import { Project } from '@/types/goal';
import { findProjectInTree } from '@/lib/projectTree';

interface TreeNodeProps {
  project: Project;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string;
}

function TreeNode({ project, depth, expandedIds, onToggle, onSelect, selectedId }: TreeNodeProps) {
  const hasChildren = project.children && project.children.length > 0;
  const isExpanded = expandedIds.has(project.id);
  const isSelected = selectedId === project.id;

  return (
    <>
      <div
        className={`flex items-center gap-1 py-2 px-2 cursor-pointer hover:bg-muted/30 ${
          isSelected ? 'bg-accent/50' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(project.id);
        }}
      >
        {hasChildren ? (
          <button
            className="p-0 h-4 w-4 flex items-center justify-center hover:bg-accent-foreground/10 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(project.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-semibold truncate">{project.name}</span>
          {project.description && (
            <span className="text-xs text-muted-foreground truncate">{project.description}</span>
          )}
        </div>
      </div>
      {hasChildren && isExpanded && (
        <>
          {project.children!.map((child) => (
            <TreeNode
              key={child.id}
              project={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </>
      )}
    </>
  );
}

const EXPANDED_IDS_KEY = 'project_tree_expanded_ids';

// localStorage에서 펼쳐진 상태 로드
const loadExpandedIds = (): Set<string> => {
  try {
    const stored = localStorage.getItem(EXPANDED_IDS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('Failed to load expanded ids:', e);
  }
  return new Set();
};

// localStorage에 펼쳐진 상태 저장
const saveExpandedIds = (ids: Set<string>) => {
  try {
    localStorage.setItem(EXPANDED_IDS_KEY, JSON.stringify([...ids]));
  } catch (e) {
    console.error('Failed to save expanded ids:', e);
  }
};

export const ProjectSelector = () => {
  const {
    projects,
    projectTree,
    currentProject,
    setCurrentProject,
    includeDescendants,
    setIncludeDescendants,
    isLoading,
    createProject,
    updateProject,
    deleteProject
  } = useProject();
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => loadExpandedIds());

  if (isLoading || !currentProject) {
    return (
      <div className="text-lg">
        <span className="font-bold text-muted-foreground">로딩 중...</span>
      </div>
    );
  }

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveExpandedIds(next);
      return next;
    });
  };

  const handleSelect = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (project) {
      setCurrentProject(project);
    }
  };

  // Check if current project has children
  const currentProjectInTree = findProjectInTree(projectTree, currentProject.id);
  const hasChildren = currentProjectInTree?.children && currentProjectInTree.children.length > 0;

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Select
            value={currentProject.id}
            onValueChange={handleSelect}
          >
            <SelectTrigger className="border-none shadow-none hover:bg-muted/50 transition-colors p-0 h-auto gap-2 w-auto [&>svg]:hidden">
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-lg font-bold truncate max-w-[120px] sm:max-w-[160px] md:max-w-[260px]" title={currentProject.name}>{currentProject.name}</h2>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
                {currentProject.description && (
                  <p className="hidden sm:block text-sm text-muted-foreground truncate max-w-[200px] md:max-w-[300px]">
                    {currentProject.description}
                  </p>
                )}
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              <div className="max-h-[350px] overflow-y-auto">
                {projectTree.map((project) => (
                  <TreeNode
                    key={project.id}
                    project={project}
                    depth={0}
                    expandedIds={expandedIds}
                    onToggle={handleToggle}
                    onSelect={handleSelect}
                    selectedId={currentProject.id}
                  />
                ))}
              </div>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManageDialogOpen(true)}
            className="h-8 w-8 p-0"
            title="프로젝트 관리"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {hasChildren && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-descendants"
              checked={includeDescendants}
              onCheckedChange={(checked) => setIncludeDescendants(checked as boolean)}
            />
            <label
              htmlFor="include-descendants"
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              하위 프로젝트 목표 포함
            </label>
          </div>
        )}
      </div>

      <ProjectManageDialog
        open={manageDialogOpen}
        onClose={() => setManageDialogOpen(false)}
        projects={projects}
        projectTree={projectTree}
        currentProject={currentProject}
        onCreateProject={createProject}
        onUpdateProject={updateProject}
        onDeleteProject={deleteProject}
        onSelectProject={setCurrentProject}
      />
    </>
  );
};
