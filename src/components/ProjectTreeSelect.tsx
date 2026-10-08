import { useState } from 'react';
import { Project } from '@/types/goal';
import { ChevronRight, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface ProjectTreeSelectProps {
  projects: Project[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  excludeIds?: string[]; // 선택 불가능한 프로젝트 ID 목록 (현재 프로젝트와 그 자손들)
  placeholder?: string;
}

interface TreeNodeProps {
  project: Project;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null | undefined;
  excludeIds: Set<string>;
}

function TreeNode({ project, depth, expandedIds, onToggle, onSelect, selectedId, excludeIds }: TreeNodeProps) {
  const hasChildren = project.children && project.children.length > 0;
  const isExpanded = expandedIds.has(project.id);
  const isDisabled = excludeIds.has(project.id);
  const isSelected = selectedId === project.id;

  return (
    <>
      <div
        className={`flex items-center gap-1 py-2 px-2 cursor-pointer hover:bg-accent ${
          isSelected ? 'bg-accent' : ''
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDisabled) {
            onSelect(project.id);
          }
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
        <span className="text-sm truncate flex-1">{project.name}</span>
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
              excludeIds={excludeIds}
            />
          ))}
        </>
      )}
    </>
  );
}

export function ProjectTreeSelect({
  projects,
  value,
  onChange,
  excludeIds = [],
  placeholder = '부모 프로젝트 선택',
}: ProjectTreeSelectProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => loadExpandedIds());
  const excludeSet = new Set(excludeIds);

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
    onChange(id);
  };

  // 현재 선택된 프로젝트의 이름 찾기
  const findProjectName = (projects: Project[], id: string | null | undefined): string | null => {
    if (!id) return null;

    for (const project of projects) {
      if (project.id === id) return project.name;
      if (project.children) {
        const found = findProjectName(project.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedName = findProjectName(projects, value);

  return (
    <Select
      value={value || 'none'}
      onValueChange={(val) => onChange(val === 'none' ? null : val)}
    >
      <SelectTrigger>
        <SelectValue>
          {selectedName || placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        <SelectItem value="none">
          <span className="text-muted-foreground">부모 없음 (최상위)</span>
        </SelectItem>
        <div className="border-t my-1" />
        <div className="max-h-[250px] overflow-y-auto">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={(e) => {
                e.preventDefault();
                if (!excludeSet.has(project.id)) {
                  handleSelect(project.id);
                }
              }}
            >
              <TreeNode
                project={project}
                depth={0}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                onSelect={handleSelect}
                selectedId={value}
                excludeIds={excludeSet}
              />
            </div>
          ))}
        </div>
      </SelectContent>
    </Select>
  );
}
